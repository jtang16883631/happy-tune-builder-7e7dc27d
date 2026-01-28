import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current week range (Monday-Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    // Calculate Monday (start of week)
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    
    // Calculate Sunday (end of week)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekStartStr = monday.toISOString().split("T")[0];
    const weekEndStr = sunday.toISOString().split("T")[0];

    console.log(`Checking timesheets for week: ${weekStartStr} to ${weekEndStr}`);

    // Get all profiles with emails
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, first_name, last_name")
      .not("email", "is", null);

    if (profilesError) throw profilesError;

    // Get submitted timesheets for this week
    const { data: submittedEntries, error: entriesError } = await supabase
      .from("timesheet_entries")
      .select("user_id, status")
      .gte("work_date", weekStartStr)
      .lte("work_date", weekEndStr)
      .eq("status", "submitted");

    if (entriesError) throw entriesError;

    // Find users who have submitted
    const submittedUserIds = new Set(submittedEntries?.map((e) => e.user_id) || []);

    // Find users who haven't submitted
    const unsubmittedProfiles = (profiles as Profile[]).filter(
      (p) => !submittedUserIds.has(p.id) && p.email
    );

    console.log(`Found ${unsubmittedProfiles.length} users who haven't submitted`);

    // Send reminder emails
    const emailPromises = unsubmittedProfiles.map(async (profile) => {
      const name =
        profile.full_name ||
        [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
        "Team Member";

      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Timesheet Reminder <noreply@resend.dev>",
          to: [profile.email],
          subject: "Reminder: Please Submit Your Timesheet",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Timesheet Reminder</h2>
              <p>Hi ${name},</p>
              <p>This is a friendly reminder that your timesheet for the week of <strong>${weekStartStr}</strong> to <strong>${weekEndStr}</strong> has not been submitted yet.</p>
              <p>Please log in and submit your timesheet as soon as possible.</p>
              <p style="color: #666; font-size: 14px; margin-top: 30px;">
                This is an automated reminder sent every Sunday at 7:00 PM.
              </p>
            </div>
          `,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error(`Failed to send email to ${profile.email}: ${errorText}`);
        return { email: profile.email, success: false, error: errorText };
      }

      console.log(`Sent reminder to ${profile.email}`);
      return { email: profile.email, success: true };
    });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        message: `Sent ${successCount} reminders, ${failCount} failed`,
        results,
        weekRange: { start: weekStartStr, end: weekEndStr },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in timesheet-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
