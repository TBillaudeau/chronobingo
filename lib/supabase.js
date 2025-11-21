import { createClient } from '@supabase/supabase-js';

// Safe fallbacks. 
// Note: 'https://placeholder.supabase.co' is a valid URL structure, 
// preventing 'TypeError: Invalid URL' in the console if keys are missing.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false // We manage our own simplified session
  }
});
