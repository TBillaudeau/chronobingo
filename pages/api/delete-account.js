import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { userId } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    // Check for Service Role Key
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Server misconfiguration: Missing Service Role Key' });
    }

    // Initialize Supabase Admin Client
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        }
    );

    try {
        // 1. Delete User from Auth (This is the critical part that requires Admin rights)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authError) {
            throw authError;
        }

        // 2. Delete User Profile (Data) - We can do this here too to be sure
        const { error: dbError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (dbError) {
            console.warn("Profile delete warning (might already be gone):", dbError);
        }

        return res.status(200).json({ success: true });

    } catch (error) {
        console.error("Delete API Error:", error);
        return res.status(500).json({ error: error.message });
    }
}
