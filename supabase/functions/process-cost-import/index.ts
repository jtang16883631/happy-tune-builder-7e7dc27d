import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Escape a value for use in a SQL VALUES list */
function sqlVal(val: string | null): string {
  if (val == null) return "NULL";
  return `'${val.replace(/'/g, "''")}'`;
}

function sqlNum(val: number | null): string {
  if (val == null) return "NULL";
  return String(val);
}

function truncate(val: any, maxLen = 255): string | null {
  if (val == null) return null;
  const str = String(val).trim();
  return str.length > maxLen ? str.substring(0, maxLen) : str || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { job_id } = body;

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch job record
    const { data: job, error: jobErr } = await admin
      .from("import_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (job.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to processing
    await admin
      .from("import_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    console.log(
      `[process-cost-import] Starting job ${job_id}, file: ${job.file_path}`
    );

    // Open direct Postgres connection pool (single connection)
    const pool = new Pool(dbUrl, 1);

    try {
      // 1. Download file from storage
      const { data: fileData, error: dlErr } = await admin.storage
        .from("uploads")
        .download(job.file_path);

      if (dlErr || !fileData) {
        throw new Error(
          `Failed to download file: ${dlErr?.message || "No data"}`
        );
      }

      const arrayBuffer = await fileData.arrayBuffer();
      console.log(
        `[process-cost-import] File downloaded: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`
      );

      // 2. Parse Excel server-side
      const workbook = XLSX.read(new Uint8Array(arrayBuffer), {
        type: "array",
      });

      const allItems: {
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
      }[] = [];

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          defval: null,
        });
        if (rows.length <= 1) continue;

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          if (!row || !row[0] || String(row[0]).trim().length === 0) continue;

          let billingDate: string | null = null;
          if (row[5] != null && String(row[5]).trim()) {
            if (typeof row[5] === "number") {
              const d = new Date((row[5] - 25569) * 86400 * 1000);
              billingDate = d.toISOString().split("T")[0];
            } else {
              const parsed = new Date(String(row[5]));
              billingDate = isNaN(parsed.getTime())
                ? truncate(String(row[5]), 50)
                : parsed.toISOString().split("T")[0];
            }
          }

          allItems.push({
            ndc: truncate(row[0], 50),
            material_description: truncate(row[1], 255),
            unit_price: row[2] != null ? parseFloat(String(row[2])) : null,
            source: truncate(row[3], 255),
            material: truncate(row[4], 50),
            billing_date: billingDate,
            manufacturer: truncate(row[6], 255),
            generic: truncate(row[7], 255),
            strength: truncate(row[8], 100),
            size: truncate(row[9], 50),
            dose: truncate(row[10], 100),
            sheet_name: truncate(sheetName, 50),
          });
        }
      }

      const totalRows = allItems.length;
      console.log(
        `[process-cost-import] Parsed ${totalRows} rows from ${workbook.SheetNames.length} sheets`
      );

      await admin
        .from("import_jobs")
        .update({
          total_rows: totalRows,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job_id);

      // 3. Bulk INSERT into staging via direct Postgres (bypasses API + RLS entirely)
      const BATCH_SIZE = 5000;
      let processedRows = 0;
      const startTime = Date.now();
      let totalBatchMs = 0;
      let batchCount = 0;

      const conn = await pool.connect();
      try {
        for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
          const batch = allItems.slice(i, i + BATCH_SIZE);
          const batchStart = Date.now();

          // Build multi-row VALUES clause
          const valueRows = batch
            .map(
              (item) =>
                `(${sqlVal(job_id)},${sqlVal(job.template_id)},${sqlVal(item.ndc)},${sqlVal(item.material_description)},${sqlNum(item.unit_price)},${sqlVal(item.source)},${sqlVal(item.material)},${sqlVal(item.billing_date)},${sqlVal(item.manufacturer)},${sqlVal(item.generic)},${sqlVal(item.strength)},${sqlVal(item.size)},${sqlVal(item.dose)},${sqlVal(item.sheet_name)})`
            )
            .join(",\n");

          await conn.queryArray(
            `INSERT INTO public.import_staging_cost_items
             (job_id, template_id, ndc, material_description, unit_price, source, material, billing_date, manufacturer, generic, strength, size, dose, sheet_name)
             VALUES ${valueRows}`
          );

          const batchMs = Date.now() - batchStart;
          totalBatchMs += batchMs;
          batchCount++;
          processedRows += batch.length;

          const elapsedSec = (Date.now() - startTime) / 1000;
          const rowsPerSec =
            elapsedSec > 0 ? Math.round(processedRows / elapsedSec) : 0;
          const avgBatchMs = Math.round(totalBatchMs / batchCount);

          // Update progress every 5 batches (25K rows)
          if (
            batchCount % 5 === 0 ||
            i + BATCH_SIZE >= allItems.length
          ) {
            await admin
              .from("import_jobs")
              .update({
                processed_rows: processedRows,
                rows_per_sec: rowsPerSec,
                avg_batch_ms: avgBatchMs,
                updated_at: new Date().toISOString(),
              })
              .eq("id", job_id);

            console.log(
              `[process-cost-import] Staged ${processedRows}/${totalRows} (${rowsPerSec} rows/sec, ${avgBatchMs}ms/batch)`
            );
          }
        }

        // 4. Merge: delete old cost items + copy from staging, all via direct SQL
        await admin
          .from("import_jobs")
          .update({
            status: "merging",
            updated_at: new Date().toISOString(),
          })
          .eq("id", job_id);

        console.log(
          `[process-cost-import] Merging: deleting old cost items for template ${job.template_id}`
        );

        // Delete existing cost items via direct SQL (fast, no RLS)
        const deleteResult = await conn.queryArray(
          `DELETE FROM public.template_cost_items WHERE template_id = '${job.template_id.replace(/'/g, "''")}'`
        );
        console.log(
          `[process-cost-import] Deleted old cost items via direct SQL`
        );

        // Copy staging → final via direct SQL (single INSERT...SELECT, no data round-trip)
        await conn.queryArray(
          `INSERT INTO public.template_cost_items
             (template_id, ndc, material_description, unit_price, source, material, billing_date, manufacturer, generic, strength, size, dose, sheet_name)
           SELECT template_id, ndc, material_description, unit_price, source, material, billing_date, manufacturer, generic, strength, size, dose, sheet_name
           FROM public.import_staging_cost_items
           WHERE job_id = '${job_id.replace(/'/g, "''")}'`
        );

        console.log(
          `[process-cost-import] Merge complete: ${totalRows} rows via INSERT...SELECT`
        );

        // 5. Cleanup staging via direct SQL
        await conn.queryArray(
          `DELETE FROM public.import_staging_cost_items WHERE job_id = '${job_id.replace(/'/g, "''")}'`
        );
      } finally {
        conn.release();
      }

      // 6. Update template cost_file_name
      if (job.cost_file_name) {
        await admin
          .from("data_templates")
          .update({
            cost_file_name: job.cost_file_name,
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.template_id);
      }

      // 7. Mark job complete
      const elapsedTotal = (Date.now() - startTime) / 1000;
      await admin
        .from("import_jobs")
        .update({
          status: "complete",
          processed_rows: totalRows,
          rows_per_sec: Math.round(totalRows / elapsedTotal),
          avg_batch_ms: batchCount > 0 ? Math.round(totalBatchMs / batchCount) : 0,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job_id);

      // 8. Cleanup uploaded file
      await admin.storage.from("uploads").remove([job.file_path]);

      console.log(
        `[process-cost-import] Job ${job_id} complete: ${totalRows} rows in ${elapsedTotal.toFixed(1)}s`
      );

      // NOTE: Offline package build is NOT triggered here.
      // It should be triggered separately (e.g. by the client after import completes).

      await pool.end();

      return new Response(
        JSON.stringify({
          success: true,
          job_id,
          total_rows: totalRows,
          elapsed_sec: elapsedTotal.toFixed(1),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (processErr: any) {
      console.error(
        `[process-cost-import] Processing error:`,
        processErr.message
      );

      // Cleanup staging on error (use admin client as fallback)
      await admin
        .from("import_staging_cost_items")
        .delete()
        .eq("job_id", job_id)
        .catch(() => {});

      await admin
        .from("import_jobs")
        .update({
          status: "failed",
          error_message: processErr.message,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job_id);

      await pool.end().catch(() => {});

      return new Response(
        JSON.stringify({ error: processErr.message, job_id }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (err: any) {
    console.error(`[process-cost-import] Fatal error:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
