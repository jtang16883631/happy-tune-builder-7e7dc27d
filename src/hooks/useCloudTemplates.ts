import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ImportJobStatus {
  id: string;
  status: 'pending' | 'processing' | 'merging' | 'complete' | 'failed';
  package_status: 'none' | 'building' | 'ready' | 'failed';
  package_path: string | null;
  package_error: string | null;
  total_rows: number;
  processed_rows: number;
  rows_per_sec: number;
  avg_batch_ms: number;
  error_message: string | null;
}

type CostImportPayloadRow = {
  ndc: string | null;
  material_description: string | null;
  unit_price: number | null;
  source: string | null;
  material: string | null;
  billing_date: string | null;
  manufacturer: string | null;
  generic: string | null;
  strength: string | null;
  size: string | null;
  dose: string | null;
  sheet_name: string | null;
};

const COST_IMPORT_CHUNK_SIZE = 5000;

function truncateText(value: unknown, maxLength: number): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function normalizeBillingDate(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;

  if (typeof value === 'number') {
    const parsed = new Date((value - 25569) * 86400 * 1000);
    return Number.isNaN(parsed.getTime()) ? text.slice(0, 50) : parsed.toISOString().slice(0, 10);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text.slice(0, 50) : parsed.toISOString().slice(0, 10);
}

function normalizeCostImportRow(row: any[], sheetName: string): CostImportPayloadRow | null {
  const ndc = truncateText(row?.[0], 50);
  if (!ndc) return null;

  const unitPriceRaw = row?.[2];
  let unitPrice: number | null = null;
  if (unitPriceRaw != null && String(unitPriceRaw).trim() !== '') {
    const parsed = Number(unitPriceRaw);
    unitPrice = Number.isFinite(parsed) ? parsed : null;
  }

  return {
    ndc,
    material_description: truncateText(row?.[1], 255),
    unit_price: unitPrice,
    source: truncateText(row?.[3], 255),
    material: truncateText(row?.[4], 50),
    billing_date: normalizeBillingDate(row?.[5]),
    manufacturer: truncateText(row?.[6], 255),
    generic: truncateText(row?.[7], 255),
    strength: truncateText(row?.[8], 100),
    size: truncateText(row?.[9], 50),
    dose: truncateText(row?.[10], 100),
    sheet_name: truncateText(sheetName, 50),
  };
}

async function uploadCostImportChunk(params: {
  baseUrl: string;
  headers: Record<string, string>;
  jobId: string;
  chunkIndex: number;
  totalChunks: number;
  rows: CostImportPayloadRow[];
}) {
  const { baseUrl, headers, jobId, chunkIndex, totalChunks, rows } = params;
  const response = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: jobId,
      action: 'append',
      rows,
      chunk_index: chunkIndex,
      total_chunks: totalChunks,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Chunk ${chunkIndex + 1}/${totalChunks} failed: ${errBody}`);
  }
}

/**
 * Parse Excel client-side, create import job, send parsed rows in chunks
 * to the backend for bulk SQL insert, then call finalize for merge + package build.
 */
async function startCostImportJob(
  templateId: string,
  userId: string,
  costFile: File,
  costFileName: string,
  onChunkProgress?: (sent: number, total: number) => void
): Promise<{ jobId: string } | { error: string }> {
  const XLSX = await import('xlsx');

  console.log(`[CostImport] Parsing ${costFileName} client-side...`);
  const arrayBuffer = await costFile.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

  let totalRows = 0;
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (rows.length <= 1) continue;
    for (let r = 1; r < rows.length; r++) {
      if (normalizeCostImportRow(rows[r], sheetName)) {
        totalRows += 1;
      }
    }
  }

  console.log(`[CostImport] Parsed workbook metadata for ${totalRows} rows from ${workbook.SheetNames.length} sheets`);

  if (totalRows === 0) {
    return { error: 'No data rows found in the Excel file' };
  }

  const { data: job, error: jobErr } = await supabase
    .from('import_jobs')
    .insert({
      template_id: templateId,
      user_id: userId,
      file_path: `client-parsed/${templateId}/${Date.now()}`,
      cost_file_name: costFileName,
      status: 'pending',
      total_rows: totalRows,
    })
    .select('id')
    .single();

  if (jobErr || !job) {
    return { error: `Job creation failed: ${jobErr?.message || 'Unknown'}` };
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { error: 'No active session' };
  }

  const totalChunks = Math.max(1, Math.ceil(totalRows / COST_IMPORT_CHUNK_SIZE));
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/process-cost-import`;
  const headers = {
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    'Content-Type': 'application/json',
  };

  let uploadedRows = 0;
  let chunkIndex = 0;
  let chunkRows: CostImportPayloadRow[] = [];

  const flushChunk = async () => {
    if (chunkRows.length === 0) return;
    const currentChunk = chunkRows;
    chunkRows = [];
    await uploadCostImportChunk({
      baseUrl,
      headers,
      jobId: job.id,
      chunkIndex,
      totalChunks,
      rows: currentChunk,
    });
    chunkIndex += 1;
    uploadedRows += currentChunk.length;
    onChunkProgress?.(uploadedRows, totalRows);
  };

  try {
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
      if (rows.length <= 1) continue;

      for (let r = 1; r < rows.length; r++) {
        const normalized = normalizeCostImportRow(rows[r], sheetName);
        if (!normalized) continue;
        chunkRows.push(normalized);
        if (chunkRows.length >= COST_IMPORT_CHUNK_SIZE) {
          await flushChunk();
        }
      }
    }

    await flushChunk();
  } catch (err: any) {
    console.error('[CostImport] Chunk upload failed:', err);
    return { error: err?.message || 'Chunk upload failed' };
  }

  console.log(`[CostImport] Uploaded ${uploadedRows} rows in ${chunkIndex} chunk(s), finalizing...`);

  fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      job_id: job.id,
      action: 'finalize',
      total_rows: totalRows,
    }),
  }).catch(err => console.warn('[CostImport] Finalize invoke error:', err));

  return { jobId: job.id };
}

/**
 * Poll import job status including package_status
 */
async function pollImportJob(jobId: string): Promise<ImportJobStatus | null> {
  const { data, error } = await supabase
    .from('import_jobs')
    .select('id, status, total_rows, processed_rows, rows_per_sec, avg_batch_ms, error_message, package_status, package_path, package_error')
    .eq('id', jobId)
    .single();

  if (error || !data) return null;
  return data as unknown as ImportJobStatus;
}

export type TemplateStatus = 'active' | 'working' | 'completed';

export interface CloudTemplate {
  id: string;
  user_id: string;
  name: string;
  inv_date: string | null;
  facility_name: string | null;
  address: string | null;
  inv_number: string | null;
  cost_file_name: string | null;
  job_ticket_file_name: string | null;
  status: TemplateStatus | null;
  created_at: string;
  updated_at: string;
}

export interface CloudSection {
  id: string;
  template_id: string;
  sect: string;
  description: string | null;
  full_section: string | null;
  cost_sheet?: string | null;
  created_at: string;
}

export interface CloudCostItem {
  id: string;
  template_id: string;
  ndc: string | null;
  material_description: string | null;
  unit_price: number | null;
  source: string | null;
  material: string | null;
  billing_date: string | null;
  manufacturer: string | null;
  generic: string | null;
  strength: string | null;
  size: string | null;
  dose: string | null;
  sheet_name: string | null;
  created_at: string;
}

export function useCloudTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CloudTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all templates for current user
  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      let allTemplates: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error: fetchError } = await supabase
          .from('data_templates')
          .select('*')
          .order('inv_date', { ascending: false, nullsFirst: false })
          .range(from, from + pageSize - 1);
        if (fetchError) throw fetchError;
        if (!data || data.length === 0) break;
        allTemplates = allTemplates.concat(data);
        if (data.length < pageSize) break;
        from += pageSize;
      }

      setTemplates(allTemplates as CloudTemplate[]);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching templates:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Parse job ticket to extract sections and metadata (client-side, lightweight)
  const parseJobTicket = (rawData: any[][], fileName?: string): {
    invDate: string | null;
    invNumber: string | null;
    facilityName: string | null;
    address: string | null;
    sections: { sect: string; description: string; costSheet: string | null }[];
  } => {
    let invDate: string | null = null;
    let invNumber: string | null = null;
    let facilityName: string | null = null;
    let address: string | null = null;
    const sections: { sect: string; description: string; costSheet: string | null }[] = [];

    // Extract address from cell C5 (row index 4, col index 2)
    if (rawData.length > 4 && rawData[4] && rawData[4].length > 2 && rawData[4][2]) {
      address = String(rawData[4][2]).trim() || null;
    }

    // Try to extract invoice number from filename first
    if (fileName) {
      const fileNameWithoutExt = fileName.replace(/\.(xlsx?|xls)$/i, '');
      const invoiceMatch = fileNameWithoutExt.match(/^(\d{8})/);
      if (invoiceMatch) {
        invNumber = invoiceMatch[1];
      }
    }

    // Scan raw data for metadata
    for (let r = 0; r < rawData.length; r++) {
      for (let c = 0; c < rawData[r].length; c++) {
        const cellValue = String(rawData[r][c] || '').toLowerCase().trim();

        if (cellValue === 'facility name' || cellValue.includes('facility name')) {
          if (c + 1 < rawData[r].length && rawData[r][c + 1]) {
            facilityName = String(rawData[r][c + 1]).trim();
          }
        }

        if (cellValue === 'inv. #' || cellValue === 'inv #' || cellValue === 'inv.#' || 
            cellValue === 'invoice #' || cellValue === 'invoice number' || 
            cellValue.includes('inv. #') || cellValue.includes('invoice #')) {
          if (c + 1 < rawData[r].length && rawData[r][c + 1]) {
            const parsedInvNum = String(rawData[r][c + 1]).trim();
            if (parsedInvNum) {
              invNumber = parsedInvNum;
            }
          }
        }

        if (cellValue === 'inv. date' || cellValue === 'inv date' || cellValue.includes('inv. date')) {
          if (c + 1 < rawData[r].length && rawData[r][c + 1]) {
            const rawDate = rawData[r][c + 1];
            if (rawDate) {
              try {
                if (typeof rawDate === 'number') {
                  const date = new Date((rawDate - 25569) * 86400 * 1000);
                  invDate = date.toISOString().split('T')[0];
                } else {
                  const parsed = new Date(rawDate);
                  if (!isNaN(parsed.getTime())) {
                    invDate = parsed.toISOString().split('T')[0];
                  } else {
                    invDate = String(rawDate);
                  }
                }
              } catch {
                invDate = String(rawDate);
              }
            }
          }
        }
      }
    }

    // Find Section List header and parse sections
    let sectionListRowIndex = -1;
    for (let r = 0; r < rawData.length; r++) {
      const rowText = rawData[r].map((c) => String(c || '').toLowerCase()).join(' ');
      if (rowText.includes('section list')) {
        sectionListRowIndex = r;
        break;
      }
    }

    if (sectionListRowIndex >= 0) {
      let headerRowIndex = -1;
      let sectCol = 0;
      let descCol = 1;
      let costSheetCol = -1;

      for (let r = sectionListRowIndex; r < Math.min(sectionListRowIndex + 30, rawData.length); r++) {
        const rowLower = rawData[r].map((c) => String(c || '').toLowerCase());
        const sectIdx = rowLower.findIndex((v) => v.includes('sect'));
        const descIdx = rowLower.findIndex((v) => v.includes('description'));
        const costSheetIdx = rowLower.findIndex((v) => v.includes('cost') && v.includes('sheet'));

        if (sectIdx >= 0 && descIdx >= 0) {
          headerRowIndex = r;
          sectCol = sectIdx;
          descCol = descIdx;
          costSheetCol = costSheetIdx;
          break;
        }
      }

      if (headerRowIndex === -1) {
        headerRowIndex = sectionListRowIndex + 1;
      }

      for (let r = headerRowIndex + 1; r < rawData.length; r++) {
        const sectRaw = String(rawData[r][sectCol] || '').trim();
        const descRaw = String(rawData[r][descCol] || '').trim();
        const costSheetRaw = costSheetCol >= 0 ? String(rawData[r][costSheetCol] || '').trim() : null;

        if (!sectRaw && !descRaw) {
          break;
        }

        const sectDigits = sectRaw.replace(/\D/g, '');
        const paddedSect = sectDigits ? sectDigits.padStart(4, '0') : '';

        sections.push({
          sect: paddedSect || sectRaw,
          description: descRaw,
          costSheet: costSheetRaw || null,
        });
      }
    }

    if (sections.length === 0) {
      sections.push({ sect: '0000', description: 'Default', costSheet: null });
    }

    return { invDate, invNumber, facilityName, address, sections };
  };

  // Import a template - frontend only uploads file + creates job + triggers backend
  const importTemplate = useCallback(
    async (
      templateName: string,
      costFile: File | null,
      jobTicketRawData: any[][],
      costFileName: string,
      jobTicketFileName: string,
      skipRefetch: boolean = false,
      onProgress?: (p: { stage: 'template' | 'sections' | 'uploading' | 'server'; inserted: number; total: number; jobId?: string }) => void
    ): Promise<{ success: boolean; error?: string; templateId?: string; jobId?: string }> => {
      if (!user) return { success: false, error: 'Not authenticated' };

      try {
        const { invDate, invNumber, facilityName, address, sections } = parseJobTicket(jobTicketRawData, jobTicketFileName);

        // Insert template
        const { data: templateData, error: templateError } = await supabase
          .from('data_templates')
          .insert({
            user_id: user.id,
            name: templateName,
            inv_date: invDate,
            facility_name: facilityName,
            address,
            inv_number: invNumber,
            cost_file_name: costFileName,
            job_ticket_file_name: jobTicketFileName,
          })
          .select()
          .single();

        if (templateError) {
          if (templateError.code === '23505' || templateError.message?.includes('unique')) {
            return { success: false, error: `A template named "${templateName}" already exists. Please use a different name.` };
          }
          throw templateError;
        }

        const templateId = templateData.id;

        if (skipRefetch) {
          setTemplates((prev) => {
            if (prev.some((t) => t.id === templateId)) return prev;
            return [templateData as CloudTemplate, ...prev];
          });
        }

        // Insert sections
        if (sections.length > 0) {
          const sectionInserts = sections.map((s) => ({
            template_id: templateId,
            sect: s.sect,
            description: s.description,
            full_section: `${s.sect}-${s.description}`,
            cost_sheet: s.costSheet,
          }));

          const { error: sectionsError } = await supabase
            .from('template_sections')
            .insert(sectionInserts);

          if (sectionsError) console.error('Error inserting sections:', sectionsError);
        }

        // If we have a cost file, parse client-side and send chunks to backend
        if (costFile) {
          onProgress?.({ stage: 'uploading', inserted: 0, total: 1 });

          const result = await startCostImportJob(
            templateId,
            user.id,
            costFile,
            costFileName,
            (sent, total) => onProgress?.({ stage: 'uploading', inserted: sent, total })
          );

          if ('error' in result) {
            console.error('Cost import job failed to start:', result.error);
            if (!skipRefetch) await fetchTemplates();
            return { success: true, templateId, error: `Template created but cost import failed: ${result.error}` };
          }

          onProgress?.({ stage: 'server', inserted: 0, total: 0, jobId: result.jobId });

          if (!skipRefetch) await fetchTemplates();
          return { success: true, templateId, jobId: result.jobId };
        }

        // No cost file — just template + sections
        if (!skipRefetch) await fetchTemplates();
        return { success: true, templateId };
      } catch (err: any) {
        console.error('Import template error:', err);
        return { success: false, error: err.message };
      }
    },
    [user, fetchTemplates]
  );

  // Import ticket only (no cost data)
  const importTicketOnly = useCallback(
    async (
      templateName: string,
      jobTicketRawData: any[][],
      jobTicketFileName: string,
      skipRefetch: boolean = false
    ): Promise<{ success: boolean; error?: string; templateId?: string }> => {
      if (!user) return { success: false, error: 'Not authenticated' };

      try {
        const { invDate, invNumber, facilityName, address, sections } = parseJobTicket(jobTicketRawData, jobTicketFileName);

        const { data: templateData, error: templateError } = await supabase
          .from('data_templates')
          .insert({
            user_id: user.id,
            name: templateName,
            inv_date: invDate,
            facility_name: facilityName,
            address,
            inv_number: invNumber,
            cost_file_name: null,
            job_ticket_file_name: jobTicketFileName,
          })
          .select()
          .single();

        if (templateError) {
          if (templateError.code === '23505' || templateError.message?.includes('unique')) {
            return { success: false, error: `A template named "${templateName}" already exists. Please use a different name.` };
          }
          throw templateError;
        }

        const templateId = templateData.id;

        if (skipRefetch) {
          setTemplates((prev) => {
            if (prev.some((t) => t.id === templateId)) return prev;
            return [templateData as CloudTemplate, ...prev];
          });
        }

        if (sections.length > 0) {
          const sectionInserts = sections.map((s) => ({
            template_id: templateId,
            sect: s.sect,
            description: s.description,
            full_section: `${s.sect}-${s.description}`,
            cost_sheet: s.costSheet,
          }));

          const { error: sectionsError } = await supabase
            .from('template_sections')
            .insert(sectionInserts);

          if (sectionsError) console.error('Error inserting sections:', sectionsError);
        }

        if (!skipRefetch) {
          await fetchTemplates();
        }
        return { success: true, templateId };
      } catch (err: any) {
        console.error('Import ticket only error:', err);
        return { success: false, error: err.message };
      }
    },
    [user, fetchTemplates]
  );

  // Update cost data for a template - upload file, trigger backend
  const updateCostData = useCallback(
    async (
      templateId: string,
      costFile: File,
      costFileName: string
    ): Promise<{ success: boolean; error?: string; jobId?: string }> => {
      if (!user) return { success: false, error: 'Not authenticated' };

      try {
        const result = await startCostImportJob(templateId, user.id, costFile, costFileName);

        if ('error' in result) {
          return { success: false, error: result.error };
        }

        return { success: true, jobId: result.jobId };
      } catch (err: any) {
        console.error('Update cost data error:', err);
        return { success: false, error: err.message };
      }
    },
    [user]
  );

  // Delete a template via backend function
  const deleteTemplate = useCallback(
    async (templateId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const { data, error } = await supabase.functions.invoke('delete-template', {
          body: { templateId },
        });

        if (error) {
          console.error('[deleteTemplate] Edge function error:', error);
          return { success: false, error: error.message || 'Delete failed' };
        }

        if (data?.error) {
          return { success: false, error: data.error };
        }

        console.log('[deleteTemplate] Deleted:', data?.deleted);
        await fetchTemplates();
        return { success: true };
      } catch (err: any) {
        const msg = err?.message || err?.details || String(err) || 'Unknown error';
        console.error('[deleteTemplate] Error:', msg);
        return { success: false, error: msg };
      }
    },
    [fetchTemplates]
  );

  // Get sections for a template
  const getSections = useCallback(async (templateId: string): Promise<CloudSection[]> => {
    const { data, error } = await supabase
      .from('template_sections')
      .select('*')
      .eq('template_id', templateId)
      .order('sect');

    if (error) {
      console.error('Error fetching sections:', error);
      return [];
    }
    return data || [];
  }, []);

  // Get cost item by NDC
  const getCostItemByNDC = useCallback(
    async (templateId: string, ndc: string, sheetName?: string | null): Promise<CloudCostItem | null> => {
      const cleanNdc = ndc.replace(/\D/g, '');

      let query = supabase
        .from('template_cost_items')
        .select('*')
        .eq('template_id', templateId)
        .or(`ndc.eq.${cleanNdc},ndc.eq.${ndc}`);

      if (sheetName) {
        query = query.eq('sheet_name', sheetName);
      }

      const { data, error } = await query
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching cost item:', error);
        return null;
      }
      return data;
    },
    []
  );

  // Update template status
  const updateTemplateStatus = useCallback(async (templateId: string, status: TemplateStatus) => {
    try {
      const { error: updateError } = await supabase
        .from('data_templates')
        .update({ status })
        .eq('id', templateId);

      if (updateError) throw updateError;

      setTemplates(prev => prev.map(t => 
        t.id === templateId ? { ...t, status } : t
      ));

      return { success: true };
    } catch (err: any) {
      console.error('Error updating template status:', err);
      return { success: false, error: err.message };
    }
  }, []);

  return {
    templates,
    isLoading,
    error,
    isReady: !isLoading && !!user,
    importTemplate,
    importTicketOnly,
    updateCostData,
    deleteTemplate,
    getSections,
    getCostItemByNDC,
    updateTemplateStatus,
    pollImportJob,
    refetch: fetchTemplates,
  };
}
