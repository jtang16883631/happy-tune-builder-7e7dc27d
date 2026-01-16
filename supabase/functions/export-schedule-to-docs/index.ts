import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduledJob {
  id: string;
  invoice_number: string | null;
  job_date: string;
  start_time: string | null;
  arrival_note: string | null;
  client_name: string;
  client_id: string | null;
  address: string | null;
  phone: string | null;
  previous_inventory_value: string | null;
  onsite_contact: string | null;
  corporate_contact: string | null;
  email_data_to: string | null;
  final_invoice_to: string | null;
  notes: string | null;
  special_notes: string | null;
  team_member_names: string[];
  team_count: number | null;
  is_travel_day: boolean | null;
  travel_info: string | null;
  hotel_info: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabase.auth.getClaims(token);
    if (authError || !userData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { date, jobs } = await req.json() as { date: string; jobs: ScheduledJob[] };

    if (!date || !jobs) {
      return new Response(
        JSON.stringify({ error: 'Date and jobs are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format the schedule as text (can be used for clipboard or Google Docs)
    const formattedSchedule = formatScheduleForDocs(date, jobs);

    // Check if Google API credentials are configured
    const googleCredentials = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
    
    if (googleCredentials) {
      // If Google credentials exist, we would create a Google Doc here
      // For now, return the formatted content
      console.log('Google credentials found, but Google Docs API integration pending');
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Schedule formatted successfully. Google Docs integration ready for API connection.',
          content: formattedSchedule 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Return formatted content for clipboard copy
      console.log('No Google credentials configured, returning formatted content');
      
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Schedule formatted. Add GOOGLE_SERVICE_ACCOUNT_KEY secret to enable Google Docs export.',
          content: formattedSchedule 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Export error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to export schedule', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function formatScheduleForDocs(date: string, jobs: ScheduledJob[]): string {
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  let output = `${formattedDate}\n`;
  output += '='.repeat(50) + '\n\n';

  // Find travel day info
  const travelJob = jobs.find(j => j.is_travel_day);
  if (travelJob) {
    output += '***Travel ONLY***\n';
    if (travelJob.travel_info) {
      output += `-${travelJob.travel_info}\n`;
    }
    if (travelJob.team_member_names?.length) {
      output += `Team: {${travelJob.team_member_names.join('}+{')}}\n`;
    }
    if (travelJob.hotel_info) {
      output += `Hotel Info: ${travelJob.hotel_info}\n`;
    }
    output += '\n';
  }

  // Regular jobs
  const regularJobs = jobs.filter(j => !j.is_travel_day);
  
  for (const job of regularJobs) {
    output += '-'.repeat(40) + '\n';
    
    // Invoice and start time line
    if (job.invoice_number) {
      output += `-Invoice: ${job.invoice_number}`;
      if (job.start_time) {
        output += ` START: ${job.start_time}`;
      }
      if (job.arrival_note) {
        output += ` NOTE: ${job.arrival_note}`;
      }
      output += '\n';
    }

    // Team members
    if (job.team_member_names?.length) {
      output += `(${job.team_member_names.length})${job.team_member_names.join('+')}` + '\n';
    }

    // Notes (highlighted)
    if (job.notes) {
      output += `NOTE: ${job.notes}\n`;
    }
    if (job.special_notes) {
      output += `***NOTE: ${job.special_notes}***\n`;
    }

    // Client info
    if (job.client_id) {
      output += `Client: ${job.client_id} - ${job.client_name}\n`;
    } else {
      output += `Client: ${job.client_name}\n`;
    }

    if (job.address) {
      output += `Address: ${job.address}\n`;
    }

    if (job.previous_inventory_value) {
      output += `Previous Inventory Value: ${job.previous_inventory_value}\n`;
    }

    if (job.phone) {
      output += `MH: Phone: FacPh: ${job.phone}\n`;
    }

    if (job.onsite_contact) {
      output += `Onsite Contact: ${job.onsite_contact}\n`;
    }

    if (job.corporate_contact) {
      output += `Corporate Contact: ${job.corporate_contact}\n`;
    }

    if (job.email_data_to) {
      output += `Email data to: ${job.email_data_to}\n`;
    }

    if (job.final_invoice_to) {
      output += `Final invoice: ${job.final_invoice_to}\n`;
    }

    output += '\n';
  }

  return output;
}