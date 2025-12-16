import { createClient } from '@supabase/supabase-js';

// This script is intended to be called by a cron job (e.g., GitHub Actions, Vercel Cron)
// OR manually by an admin to clean up old games.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Note: In a real backend cron, use SERVICE_ROLE_KEY to bypass RLS.
// Here we use ANON KEY implying public access or user token if refined.
// For true cleanup, RLS policies might block deletion unless row level security allows it.

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
    // Security: Check for a secret key if you want to protect this endpoint
    // if (req.query.key !== process.env.CRON_KEY) return res.status(401).json({error: 'Unauthorized'});

    const HOURS_TO_KEEP = 72;
    const MS_TO_KEEP = HOURS_TO_KEEP * 60 * 60 * 1000;
    const cutoffTime = Date.now() - MS_TO_KEEP;

    try {
        // 1. Fetch all games that MIGHT need deletion
        // Since we store data in a JSONB column 'data', we can't always query optimally with simple filters unless indexed.
        // We'll fetch a batch. Warning: This is not scalable for 1M+ rows, but fine for thousands.

        const { data: games, error } = await supabase
            .from('gamestates')
            .select('id, data');

        if (error) throw error;

        const gamesToDelete = games.filter(g => {
            const createdAt = g.data?.createdAt || 0;
            const isSaved = g.data?.isSaved === true;

            return createdAt < cutoffTime && !isSaved;
        }).map(g => g.id);

        if (gamesToDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from('gamestates')
                .delete()
                .in('id', gamesToDelete);

            if (deleteError) throw deleteError;
        }


        // 2. Clean up Guest Profiles (Ghost accounts)
        // Guests start with "guest-" and if they haven't been updated in 72h, they are gone.
        const { data: guests, error: guestError } = await supabase
            .from('profiles')
            .select('id, updated_at')
            .ilike('id', 'guest-%');

        if (guestError) console.warn("Guest fetch error:", guestError);

        let deletedGuestsCount = 0;
        if (guests && guests.length > 0) {
            const guestsToDelete = guests.filter(g => {
                // Handle various date formats safely
                const updated = g.updated_at ? new Date(g.updated_at).getTime() : 0;
                return updated < cutoffTime;
            }).map(g => g.id);

            if (guestsToDelete.length > 0) {
                const { error: deleteGuestError } = await supabase
                    .from('profiles')
                    .delete()
                    .in('id', guestsToDelete);

                if (deleteGuestError) console.error("Guest delete error:", deleteGuestError);
                else deletedGuestsCount = guestsToDelete.length;
            }
        }

        res.status(200).json({
            message: 'Cleanup complete',
            deletedGames: gamesToDelete.length,
            deletedGuests: deletedGuestsCount
        });

    } catch (err) {
        console.error('Cleanup Error:', err);
        res.status(500).json({ error: err.message });
    }
}
