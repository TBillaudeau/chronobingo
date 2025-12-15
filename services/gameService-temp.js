import { supabase } from '../lib/supabase';

// Toggle individual player's grid lock status
export const togglePlayerGridLock = async (gameId, playerId) => {
    const { data, error } = await supabase
        .from('gamestates')
        .select('data')
        .eq('id', gameId)
        .maybeSingle();

    if (error || !data) return;

    let game = data.data;

    const playerIndex = game.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
        game.players[playerIndex].isGridLocked = !game.players[playerIndex].isGridLocked;
        await supabase.from('gamestates').update({ data: game }).eq('id', gameId);
    }
};
