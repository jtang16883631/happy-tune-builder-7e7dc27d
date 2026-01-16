import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is a manager
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is manager
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'manager')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: Manager role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, ndc, searchTerm } = await req.json();
    console.log(`Processing action: ${action}, ndc: ${ndc}, searchTerm: ${searchTerm}`);

    if (action === 'lookup') {
      // Lookup single NDC from openFDA
      if (!ndc) {
        return new Response(JSON.stringify({ error: 'NDC required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Format NDC for search (remove dashes)
      const cleanNdc = ndc.replace(/-/g, '');
      
      // Search openFDA drug database
      const fdaUrl = `https://api.fda.gov/drug/ndc.json?search=product_ndc:"${ndc}"+OR+package_ndc:"${ndc}"&limit=1`;
      console.log(`Fetching from FDA: ${fdaUrl}`);
      
      const fdaResponse = await fetch(fdaUrl);
      
      if (!fdaResponse.ok) {
        if (fdaResponse.status === 404) {
          return new Response(JSON.stringify({ 
            found: false, 
            message: 'NDC not found in FDA database' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`FDA API error: ${fdaResponse.status}`);
      }

      const fdaData = await fdaResponse.json();
      
      if (!fdaData.results || fdaData.results.length === 0) {
        return new Response(JSON.stringify({ 
          found: false, 
          message: 'NDC not found in FDA database' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const drug = fdaData.results[0];
      const drugInfo = {
        ndc: drug.product_ndc || ndc,
        drug_name: drug.brand_name || drug.generic_name || 'Unknown',
        manufacturer: drug.labeler_name || null,
        package_description: drug.packaging?.[0]?.description || null,
        dea_schedule: drug.dea_schedule || null,
        fda_status: drug.marketing_status || 'Active',
        source: 'fda',
      };

      return new Response(JSON.stringify({ found: true, drug: drugInfo }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'search') {
      // Search FDA by drug name
      if (!searchTerm) {
        return new Response(JSON.stringify({ error: 'Search term required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const fdaUrl = `https://api.fda.gov/drug/ndc.json?search=brand_name:"${searchTerm}"+OR+generic_name:"${searchTerm}"&limit=20`;
      console.log(`Searching FDA: ${fdaUrl}`);
      
      const fdaResponse = await fetch(fdaUrl);
      
      if (!fdaResponse.ok) {
        if (fdaResponse.status === 404) {
          return new Response(JSON.stringify({ results: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`FDA API error: ${fdaResponse.status}`);
      }

      const fdaData = await fdaResponse.json();
      
      const results = (fdaData.results || []).map((drug: any) => ({
        ndc: drug.product_ndc,
        drug_name: drug.brand_name || drug.generic_name || 'Unknown',
        manufacturer: drug.labeler_name || null,
        package_description: drug.packaging?.[0]?.description || null,
        dea_schedule: drug.dea_schedule || null,
        fda_status: drug.marketing_status || 'Active',
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'import') {
      // Import drug data to database
      const { drugs } = await req.json();
      
      if (!drugs || !Array.isArray(drugs)) {
        return new Response(JSON.stringify({ error: 'Drugs array required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data, error } = await supabase
        .from('drugs')
        .upsert(
          drugs.map((d: any) => ({
            ...d,
            source: 'fda',
            updated_at: new Date().toISOString(),
          })),
          { onConflict: 'ndc' }
        )
        .select();

      if (error) {
        console.error('Import error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ imported: data?.length || 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
