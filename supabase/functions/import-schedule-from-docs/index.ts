import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParsedScheduleEvent {
  job_date: string;
  end_date: string | null;
  event_type: 'work' | 'travel' | 'off' | 'note';
  event_title: string | null;
  invoice_number: string | null;
  start_time: string | null;
  arrival_note: string | null;
  client_name: string;
  address: string | null;
  phone: string | null;
  onsite_contact: string | null;
  corporate_contact: string | null;
  email_data_to: string | null;
  final_invoice_to: string | null;
  notes: string | null;
  special_notes: string | null;
  team_members: string[];
  hotel_info: string | null;
  travel_info: string | null;
  location_from: string | null;
  location_to: string | null;
}

interface ImportRequest {
  documentId?: string;
  documentUrl?: string;
  content?: string;
  yearShift?: number; // e.g., 1 to shift 2025 -> 2026
  teamMemberMapping?: Record<string, string>; // name -> id mapping
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ImportRequest = await req.json();
    const { documentId, documentUrl, content, yearShift = 1, teamMemberMapping = {} } = body;

    let docContent = content;

    // If documentId or URL provided, fetch from Google Docs API
    if (!docContent && (documentId || documentUrl)) {
      const googleCredentials = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY');
      if (!googleCredentials) {
        return new Response(
          JSON.stringify({ 
            error: 'Google credentials not configured',
            requiresManualPaste: true,
            message: 'Please paste the Google Doc content directly'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const docId = documentId || extractDocIdFromUrl(documentUrl!);
      if (!docId) {
        return new Response(
          JSON.stringify({ error: 'Invalid document URL' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      docContent = await fetchGoogleDocContent(JSON.parse(googleCredentials), docId);
    }

    if (!docContent) {
      return new Response(
        JSON.stringify({ error: 'No content provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the schedule content
    const parsedEvents = parseScheduleContent(docContent, yearShift, teamMemberMapping);

    return new Response(
      JSON.stringify({
        success: true,
        events: parsedEvents,
        count: parsedEvents.length,
        message: `Parsed ${parsedEvents.length} schedule events`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Import error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Import failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractDocIdFromUrl(url: string): string | null {
  // Handle various Google Docs URL formats
  const patterns = [
    /\/document\/d\/([a-zA-Z0-9-_]+)/,
    /docs\.google\.com\/.*\/([a-zA-Z0-9-_]{25,})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchGoogleDocContent(credentials: any, docId: string): Promise<string> {
  const accessToken = await getGoogleAccessToken(credentials);
  
  // Use the Docs API to get document content
  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${docId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  const doc = await response.json();
  
  // Extract text content from the document
  let content = '';
  if (doc.body?.content) {
    for (const element of doc.body.content) {
      if (element.paragraph?.elements) {
        for (const textElement of element.paragraph.elements) {
          if (textElement.textRun?.content) {
            content += textElement.textRun.content;
          }
        }
      }
    }
  }
  
  return content;
}

async function getGoogleAccessToken(credentials: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: credentials.client_email,
    sub: credentials.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/documents.readonly',
  };

  const jwt = await signJwt(
    { alg: 'RS256', typ: 'JWT' },
    payload,
    credentials.private_key
  );

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    throw new Error('Failed to get access token');
  }
  
  return tokenData.access_token;
}

async function signJwt(header: any, payload: any, privateKeyPem: string): Promise<string> {
  const encoder = new TextEncoder();
  
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const pemContents = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\n/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

function parseScheduleContent(
  content: string, 
  yearShift: number,
  teamMemberMapping: Record<string, string>
): ParsedScheduleEvent[] {
  const events: ParsedScheduleEvent[] = [];
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  
  let currentEvent: Partial<ParsedScheduleEvent> | null = null;
  let currentSection = '';

  // Common date patterns
  const datePatterns = [
    // "Monday, January 6, 2025" or "Monday January 6 2025"
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(\w+)\s+(\d{1,2}),?\s+(\d{4})/i,
    // "Jan 6, 2025" or "January 6, 2025"
    /^(\w+)\s+(\d{1,2}),?\s+(\d{4})/i,
    // "1/6/2025" or "01/06/2025"
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  ];

  const monthMap: Record<string, number> = {
    january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2,
    april: 3, apr: 3, may: 4, june: 5, jun: 5, july: 6, jul: 6,
    august: 7, aug: 7, september: 8, sep: 8, sept: 8,
    october: 9, oct: 9, november: 10, nov: 10, december: 11, dec: 11,
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Check for date headers
    let dateMatch = null;
    let parsedDate: Date | null = null;

    for (const pattern of datePatterns) {
      dateMatch = line.match(pattern);
      if (dateMatch) break;
    }

    if (dateMatch) {
      // Save previous event if exists
      if (currentEvent && currentEvent.job_date) {
        events.push(finalizeEvent(currentEvent, teamMemberMapping));
      }

      // Parse the date
      if (dateMatch.length === 5) {
        // "Monday, January 6, 2025"
        const month = monthMap[dateMatch[2].toLowerCase()];
        const day = parseInt(dateMatch[3]);
        let year = parseInt(dateMatch[4]) + yearShift;
        parsedDate = new Date(year, month, day);
      } else if (dateMatch.length === 4 && dateMatch[1].match(/[a-zA-Z]/)) {
        // "Jan 6, 2025"
        const month = monthMap[dateMatch[1].toLowerCase()];
        const day = parseInt(dateMatch[2]);
        let year = parseInt(dateMatch[3]) + yearShift;
        parsedDate = new Date(year, month, day);
      } else if (dateMatch.length === 4) {
        // "1/6/2025"
        const month = parseInt(dateMatch[1]) - 1;
        const day = parseInt(dateMatch[2]);
        let year = parseInt(dateMatch[3]) + yearShift;
        parsedDate = new Date(year, month, day);
      }

      if (parsedDate) {
        currentEvent = {
          job_date: formatDate(parsedDate),
          event_type: 'work',
          team_members: [],
        };
        currentSection = '';
      }
      continue;
    }

    if (!currentEvent) continue;

    // Detect event type from keywords
    if (lowerLine.includes('travel') || lowerLine.includes('driving') || lowerLine.includes('flight')) {
      currentEvent.event_type = 'travel';
    } else if (lowerLine.includes('off') || lowerLine.includes('no work')) {
      currentEvent.event_type = 'off';
    }

    // Parse specific fields
    if (lowerLine.startsWith('client:') || lowerLine.startsWith('customer:') || lowerLine.startsWith('store:')) {
      currentEvent.client_name = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('address:') || lowerLine.startsWith('location:')) {
      currentEvent.address = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('invoice:') || lowerLine.startsWith('invoice #:') || lowerLine.startsWith('inv:')) {
      currentEvent.invoice_number = line.split(':').slice(1).join(':').trim().replace('#', '');
    } else if (lowerLine.startsWith('time:') || lowerLine.startsWith('start:') || lowerLine.startsWith('arrival:')) {
      const timeStr = line.split(':').slice(1).join(':').trim();
      currentEvent.start_time = parseTime(timeStr);
      if (lowerLine.includes('arrival')) {
        currentEvent.arrival_note = timeStr;
      }
    } else if (lowerLine.startsWith('phone:') || lowerLine.startsWith('tel:')) {
      currentEvent.phone = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('contact:') || lowerLine.startsWith('onsite contact:')) {
      currentEvent.onsite_contact = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('corporate:') || lowerLine.startsWith('corporate contact:')) {
      currentEvent.corporate_contact = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('email:') || lowerLine.startsWith('send data to:') || lowerLine.startsWith('data to:')) {
      currentEvent.email_data_to = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('hotel:')) {
      currentEvent.hotel_info = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('flight:') || lowerLine.startsWith('travel info:')) {
      currentEvent.travel_info = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('from:')) {
      currentEvent.location_from = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('to:') && !lowerLine.includes('email') && !lowerLine.includes('data')) {
      currentEvent.location_to = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('team:') || lowerLine.startsWith('crew:') || lowerLine.startsWith('staff:')) {
      const teamStr = line.split(':').slice(1).join(':').trim();
      const names = teamStr.split(/[,;&]/).map(n => n.trim()).filter(n => n);
      currentEvent.team_members = names;
    } else if (lowerLine.startsWith('notes:') || lowerLine.startsWith('note:')) {
      currentEvent.notes = line.split(':').slice(1).join(':').trim();
    } else if (lowerLine.startsWith('special:') || lowerLine.startsWith('special notes:')) {
      currentEvent.special_notes = line.split(':').slice(1).join(':').trim();
    } else if (!currentEvent.client_name && line.length > 3 && !line.includes(':')) {
      // First non-labeled line after date could be client name
      currentEvent.client_name = line;
    }
  }

  // Don't forget the last event
  if (currentEvent && currentEvent.job_date) {
    events.push(finalizeEvent(currentEvent, teamMemberMapping));
  }

  return events;
}

function finalizeEvent(
  event: Partial<ParsedScheduleEvent>,
  teamMemberMapping: Record<string, string>
): ParsedScheduleEvent {
  // Map team member names to IDs if mapping provided
  const mappedTeamMembers: string[] = [];
  if (event.team_members) {
    for (const name of event.team_members) {
      const lowerName = name.toLowerCase();
      // Check mapping
      for (const [mapName, mapId] of Object.entries(teamMemberMapping)) {
        if (mapName.toLowerCase() === lowerName || 
            mapName.toLowerCase().includes(lowerName) ||
            lowerName.includes(mapName.toLowerCase())) {
          mappedTeamMembers.push(mapId);
          break;
        }
      }
    }
  }

  return {
    job_date: event.job_date || '',
    end_date: event.end_date || null,
    event_type: event.event_type || 'work',
    event_title: event.event_title || null,
    invoice_number: event.invoice_number || null,
    start_time: event.start_time || null,
    arrival_note: event.arrival_note || null,
    client_name: event.client_name || 'Unnamed',
    address: event.address || null,
    phone: event.phone || null,
    onsite_contact: event.onsite_contact || null,
    corporate_contact: event.corporate_contact || null,
    email_data_to: event.email_data_to || null,
    final_invoice_to: event.final_invoice_to || null,
    notes: event.notes || null,
    special_notes: event.special_notes || null,
    team_members: mappedTeamMembers.length > 0 ? mappedTeamMembers : (event.team_members || []) as string[],
    hotel_info: event.hotel_info || null,
    travel_info: event.travel_info || null,
    location_from: event.location_from || null,
    location_to: event.location_to || null,
  };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTime(timeStr: string): string | null {
  // Handle various time formats
  const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!match) return null;

  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const period = match[3]?.toLowerCase();

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
