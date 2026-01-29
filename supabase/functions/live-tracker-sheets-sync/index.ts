import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LiveTrackerJob {
  id: string;
  promise_invoice_number: string | null;
  template_done: string | null;
  ticket_done: string | null;
  ptf_sum: string | null;
  job_number: string | null;
  group_name: string | null;
  job_name: string;
  stage: string;
  pricing_done: boolean | null;
  who_has_auto: string | null;
  automation_notes: string | null;
  master_review_by: string | null;
  draft_out_date: string | null;
  updates_date: string | null;
  closed_final_date: string | null;
  invoiced_date: string | null;
  comments: string | null;
  overdue_days: number | null;
  sheet_row_id: number | null;
  updated_at: string;
}

// Column headers for the Google Sheet
const HEADERS = [
  "ID",
  "Job Name",
  "Stage",
  "Invoice #",
  "Template Done",
  "Ticket Done",
  "PTF Sum",
  "Job #",
  "Group",
  "Pricing Done",
  "Who Has Auto",
  "Automation Notes",
  "Master Review By",
  "Draft Out Date",
  "Updates Date",
  "Closed Final Date",
  "Invoiced Date",
  "Comments",
  "Overdue Days",
  "Updated At",
];

// Stage mapping for human-readable labels
const STAGE_LABELS: Record<string, string> = {
  scheduled_jobs: "SCHEDULED JOBS",
  making_price_files: "MAKING PRICE FILES",
  pricing_complete: "Pricing Complete - Ready for template",
  files_built: "FILES BUILT - COLLECTION FILE MADE",
  needs_automation: "Compiled: NEEDS AUTOMATION/REPORTS ADDED",
  jobs_on_hold: "JOBS ON HOLD",
  ready_for_review: "FILES COMPILED READY FOR REVIEW",
  out_on_draft: "OUT ON DRAFT",
  in_for_updates: "IN FOR UPDATES",
  out_for_final: "OUT FOR FINAL",
  to_be_invoiced: "TO BE INVOICED",
  final_approved: "DONE",
};

// Reverse mapping for parsing sheet data
const STAGE_VALUES: Record<string, string> = Object.entries(STAGE_LABELS).reduce(
  (acc, [key, value]) => {
    acc[value.toUpperCase()] = key;
    return acc;
  },
  {} as Record<string, string>
);

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  const key = JSON.parse(serviceAccountKey);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600;

  // Create JWT header and payload
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    exp,
    iat: now,
  };

  // Base64URL encode
  const encoder = new TextEncoder();
  const b64url = (data: Uint8Array) =>
    btoa(String.fromCharCode(...data))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = b64url(encoder.encode(JSON.stringify(header)));
  const payloadB64 = b64url(encoder.encode(JSON.stringify(payload)));
  const signatureInput = `${headerB64}.${payloadB64}`;

  // Import private key and sign
  const pemContent = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    encoder.encode(signatureInput)
  );

  const signatureB64 = b64url(new Uint8Array(signature));
  const jwt = `${signatureInput}.${signatureB64}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

async function createSpreadsheet(accessToken: string, title: string): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  console.log("Creating new spreadsheet:", title);

  const response = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title },
      sheets: [
        {
          properties: {
            title: "Live Tracker",
            gridProperties: { frozenRowCount: 1 },
          },
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create spreadsheet: ${error}`);
  }

  const data = await response.json();
  console.log("Spreadsheet created:", data.spreadsheetId);

  // Add headers to the first row
  await updateSheetValues(accessToken, data.spreadsheetId, "Live Tracker!A1", [HEADERS]);

  // Format header row (bold, frozen)
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${data.spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true },
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
                },
              },
              fields: "userEnteredFormat(textFormat,backgroundColor)",
            },
          },
          {
            updateSheetProperties: {
              properties: { sheetId: 0, gridProperties: { frozenRowCount: 1 } },
              fields: "gridProperties.frozenRowCount",
            },
          },
        ],
      }),
    }
  );

  return {
    spreadsheetId: data.spreadsheetId,
    spreadsheetUrl: data.spreadsheetUrl,
  };
}

async function updateSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number | boolean | null)[][]
): Promise<void> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ values }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to update sheet values: ${error}`);
  }
}

async function getSheetValues(
  accessToken: string,
  spreadsheetId: string,
  range: string
): Promise<(string | null)[][] | null> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    if (response.status === 404) return null;
    const error = await response.text();
    throw new Error(`Failed to get sheet values: ${error}`);
  }

  const data = await response.json();
  return data.values || [];
}

async function clearSheet(accessToken: string, spreadsheetId: string): Promise<void> {
  // Clear all data except headers
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Live Tracker!A2:Z10000:clear`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
}

function jobToRow(job: LiveTrackerJob): (string | number | boolean | null)[] {
  return [
    job.id,
    job.job_name,
    STAGE_LABELS[job.stage] || job.stage,
    job.promise_invoice_number,
    job.template_done,
    job.ticket_done,
    job.ptf_sum,
    job.job_number,
    job.group_name,
    job.pricing_done ? "Yes" : "No",
    job.who_has_auto,
    job.automation_notes,
    job.master_review_by,
    job.draft_out_date,
    job.updates_date,
    job.closed_final_date,
    job.invoiced_date,
    job.comments,
    job.overdue_days,
    job.updated_at,
  ];
}

function rowToJobUpdate(row: (string | null)[], existingJob?: LiveTrackerJob): Partial<LiveTrackerJob> | null {
  if (!row[0]) return null; // No ID means this row isn't valid

  const stageLabel = (row[2] || "").toUpperCase().trim();
  const stage = STAGE_VALUES[stageLabel] || (existingJob?.stage ?? "making_price_files");

  return {
    id: row[0],
    job_name: row[1] || "Untitled Job",
    stage,
    promise_invoice_number: row[3] || null,
    template_done: row[4] || null,
    ticket_done: row[5] || null,
    ptf_sum: row[6] || null,
    job_number: row[7] || null,
    group_name: row[8] || null,
    pricing_done: (row[9] || "").toLowerCase() === "yes",
    who_has_auto: row[10] || null,
    automation_notes: row[11] || null,
    master_review_by: row[12] || null,
    draft_out_date: row[13] || null,
    updates_date: row[14] || null,
    closed_final_date: row[15] || null,
    invoiced_date: row[16] || null,
    comments: row[17] || null,
    overdue_days: row[18] ? parseInt(row[18], 10) : 3,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceAccountKey = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountKey) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_SERVICE_ACCOUNT_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json();
    console.log("Action:", action);

    const accessToken = await getAccessToken(serviceAccountKey);

    // Get or create sheet config
    let { data: config } = await supabase
      .from("live_tracker_sheet_config")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!config && action === "init") {
      // Create a new spreadsheet
      const { spreadsheetId, spreadsheetUrl } = await createSpreadsheet(
        accessToken,
        "Live Tracker - Meridian Inventory"
      );

      const { data: newConfig, error: insertError } = await supabase
        .from("live_tracker_sheet_config")
        .insert({
          spreadsheet_id: spreadsheetId,
          spreadsheet_url: spreadsheetUrl,
          sync_enabled: true,
        })
        .select()
        .single();

      if (insertError) {
        console.error("Failed to save config:", insertError);
        throw new Error("Failed to save sheet config");
      }

      config = newConfig;
      console.log("Created new sheet config:", config);
    }

    if (!config) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No sheet configured. Call with action: init first.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const spreadsheetId = config.spreadsheet_id;

    if (action === "init") {
      // Return the existing or newly created config
      return new Response(
        JSON.stringify({
          success: true,
          spreadsheetId: config.spreadsheet_id,
          spreadsheetUrl: config.spreadsheet_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "push") {
      // Push all jobs to the sheet (full sync from app to sheet)
      const { data: jobs, error: jobsError } = await supabase
        .from("live_tracker_jobs")
        .select("*")
        .order("created_at", { ascending: true });

      if (jobsError) throw jobsError;

      // Clear existing data and push all jobs
      await clearSheet(accessToken, spreadsheetId);

      if (jobs && jobs.length > 0) {
        const rows = jobs.map(jobToRow);
        await updateSheetValues(accessToken, spreadsheetId, `Live Tracker!A2:T${jobs.length + 1}`, rows);

        // Update sheet_row_id for each job
        for (let i = 0; i < jobs.length; i++) {
          await supabase
            .from("live_tracker_jobs")
            .update({ sheet_row_id: i + 2 })
            .eq("id", jobs[i].id);
        }
      }

      await supabase
        .from("live_tracker_sheet_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Pushed ${jobs?.length || 0} jobs to sheet`,
          spreadsheetUrl: config.spreadsheet_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "pull") {
      // Pull changes from sheet and update database
      const sheetData = await getSheetValues(accessToken, spreadsheetId, "Live Tracker!A2:T1000");

      if (!sheetData || sheetData.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "No data in sheet", changes: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get existing jobs from database
      const { data: existingJobs } = await supabase
        .from("live_tracker_jobs")
        .select("*");

      const existingJobsMap = new Map(
        (existingJobs || []).map((job) => [job.id, job])
      );

      let changesCount = 0;
      const processedIds = new Set<string>();

      for (const row of sheetData) {
        if (!row[0]) continue; // Skip rows without ID

        const jobId = row[0];
        processedIds.add(jobId);
        const existingJob = existingJobsMap.get(jobId);
        const jobUpdate = rowToJobUpdate(row, existingJob);

        if (!jobUpdate) continue;

        // Check if there are actual changes
        if (existingJob) {
          const sheetUpdatedAt = row[19];
          const dbUpdatedAt = existingJob.updated_at;

          // Only update if the sheet data was modified after db update
          // or if key fields differ
          const hasChanges =
            existingJob.job_name !== jobUpdate.job_name ||
            existingJob.stage !== jobUpdate.stage ||
            existingJob.promise_invoice_number !== jobUpdate.promise_invoice_number ||
            existingJob.pricing_done !== jobUpdate.pricing_done ||
            existingJob.comments !== jobUpdate.comments;

          if (hasChanges) {
            const { error } = await supabase
              .from("live_tracker_jobs")
              .update({
                job_name: jobUpdate.job_name,
                stage: jobUpdate.stage,
                promise_invoice_number: jobUpdate.promise_invoice_number,
                template_done: jobUpdate.template_done,
                ticket_done: jobUpdate.ticket_done,
                ptf_sum: jobUpdate.ptf_sum,
                job_number: jobUpdate.job_number,
                group_name: jobUpdate.group_name,
                pricing_done: jobUpdate.pricing_done,
                who_has_auto: jobUpdate.who_has_auto,
                automation_notes: jobUpdate.automation_notes,
                master_review_by: jobUpdate.master_review_by,
                draft_out_date: jobUpdate.draft_out_date,
                updates_date: jobUpdate.updates_date,
                closed_final_date: jobUpdate.closed_final_date,
                invoiced_date: jobUpdate.invoiced_date,
                comments: jobUpdate.comments,
                overdue_days: jobUpdate.overdue_days,
              })
              .eq("id", jobId);

            if (!error) changesCount++;
          }
        }
        // Note: We don't create new jobs from sheet - only update existing ones
      }

      await supabase
        .from("live_tracker_sheet_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Pulled ${changesCount} changes from sheet`,
          changes: changesCount,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "sync") {
      // Full bidirectional sync: push app data to sheet, then pull any sheet changes
      // This ensures both are in sync

      // First, push current state to sheet
      const { data: jobs } = await supabase
        .from("live_tracker_jobs")
        .select("*")
        .order("created_at", { ascending: true });

      await clearSheet(accessToken, spreadsheetId);

      if (jobs && jobs.length > 0) {
        const rows = jobs.map(jobToRow);
        await updateSheetValues(accessToken, spreadsheetId, `Live Tracker!A2:T${jobs.length + 1}`, rows);
      }

      await supabase
        .from("live_tracker_sheet_config")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", config.id);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Synced ${jobs?.length || 0} jobs`,
          spreadsheetUrl: config.spreadsheet_url,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: init, push, pull, or sync" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
