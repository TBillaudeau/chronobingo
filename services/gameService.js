
import { supabase } from '../lib/supabase';

// Storage Keys (Client side cache)
const USER_KEY = 'disco_bingo_user';
const CURRENT_GAME_KEY = 'disco_bingo_current_game'; 

// --- 1. User & Profile Management (DB + Local) ---

export const getLocalUser = () => {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(USER_KEY);
  return stored ? JSON.parse(stored) : null;
};

export const saveLocalUser = (user) => {
  if (typeof window !== 'undefined' && user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

// Sync user to DB (Upsert)
export const saveUserToDb = async (user) => {
  if (!user) return;
  saveLocalUser(user);

  const { error } = await supabase
    .from('profiles')
    .upsert({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        updated_at: new Date()
    }, { onConflict: 'id' });

  if (error) console.error("Profile Sync Error:", error);
};

export const getUserProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) return null;
    return data;
};

export const logoutUser = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(CURRENT_GAME_KEY);
};

// --- 2. Favorites & Stats Management ---

export const updateUserStats = async (userId, updates) => {
    const { data: profile } = await supabase.from('profiles').select('stats').eq('id', userId).single();
    
    const currentStats = profile?.stats || { games_played: 0, games_won: 0, songs_chosen: 0, bingos: 0 };
    
    const newStats = {
        games_played: currentStats.games_played + (updates.games_played || 0),
        games_won: currentStats.games_won + (updates.games_won || 0),
        songs_chosen: currentStats.songs_chosen + (updates.songs_chosen || 0),
        bingos: currentStats.bingos + (updates.bingos || 0)
    };

    await supabase.from('profiles').update({ stats: newStats }).eq('id', userId);
};

// Helper to update the nested JSONB "song_stats"
// Structure: { "songId": { title: "", selected: 0, validated: 0 } }
const updatePersonalSongStats = async (userId, song, action) => {
    if (!song || !song.id) return;
    const { data } = await supabase.from('profiles').select('song_stats').eq('id', userId).single();
    let stats = data?.song_stats || {};
    
    const sId = song.id.toString();
    if (!stats[sId]) {
        stats[sId] = { title: song.title, selected: 0, validated: 0 };
    }

    if (action === 'select') stats[sId].selected += 1;
    if (action === 'validate') stats[sId].validated += 1;

    await supabase.from('profiles').update({ song_stats: stats }).eq('id', userId);
};

export const toggleFavorite = async (userId, song) => {
    const profile = await getUserProfile(userId);
    if (!profile) return;

    let favs = profile.favorites || [];
    const exists = favs.find(f => f.id === song.id);

    if (exists) {
        favs = favs.filter(f => f.id !== song.id);
    } else {
        favs = [...favs, song];
    }

    await supabase.from('profiles').update({ favorites: favs }).eq('id', userId);
    return favs;
};

export const getFavorites = async (userId) => {
    const profile = await getUserProfile(userId);
    return profile?.favorites || [];
};

// --- 3. Global Song Leaderboard ---

export const incrementSongPlayCount = async (song) => {
    if (!song || !song.id) return;

    const { data: existing } = await supabase
        .from('global_songs')
        .select('play_count, validation_count')
        .eq('id', song.id.toString())
        .maybeSingle();

    if (existing) {
        await supabase
            .from('global_songs')
            .update({ 
                play_count: (existing.play_count || 0) + 1,
                last_played_at: new Date()
            })
            .eq('id', song.id.toString());
    } else {
        await supabase
            .from('global_songs')
            .insert({
                id: song.id.toString(),
                title: song.title,
                artist: song.artist,
                cover: song.cover,
                preview: song.preview,
                play_count: 1,
                validation_count: 0
            });
    }
};

export const incrementSongValidationCount = async (songId) => {
    if (!songId) return;
    const { data: existing } = await supabase
        .from('global_songs')
        .select('validation_count')
        .eq('id', songId.toString())
        .maybeSingle();

    if (existing) {
        await supabase
            .from('global_songs')
            .update({ validation_count: (existing.validation_count || 0) + 1 })
            .eq('id', songId.toString());
    }
};

export const getGlobalLeaderboard = async () => {
    // Sort by Validations first (Efficiency), then Play Count (Popularity)
    const { data, error } = await supabase
        .from('global_songs')
        .select('*')
        .order('validation_count', { ascending: false })
        .order('play_count', { ascending: false })
        .limit(10);
    
    if (error) {
        console.warn("Leaderboard fetch error:", error);
        return [];
    }
    return data;
};

// --- 4. Game Session Management ---

export const saveCurrentGameId = (gameId) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CURRENT_GAME_KEY, gameId);
};

export const getCurrentGameId = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(CURRENT_GAME_KEY);
};

export const removeCurrentGameId = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CURRENT_GAME_KEY);
};

// --- 5. History Management ---

const addToHistory = async (game, userId) => {
    if (!userId || !game) return;
    
    const profile = await getUserProfile(userId);
    if (!profile) return;

    let history = profile.history || [];
    
    const summary = {
        id: game.id,
        hostName: game.players.find(p => p.id === game.hostId)?.name || 'Unknown',
        date: Date.now(),
        status: game.status,
        myScore: game.players.find(p => p.id === userId)?.score || 0,
        userId: userId // Store who played this for filtering
    };

    history = history.filter(h => h.id !== game.id);
    history.unshift(summary);
    history = history.slice(0, 20);

    await supabase.from('profiles').update({ history }).eq('id', userId);
};

export const getGameHistory = async (userId) => {
    const profile = await getUserProfile(userId);
    return profile?.history || [];
};

// --- 6. Game Logic (Realtime) ---

export const subscribeToGame = (gameId, onUpdate) => {
  const channel = supabase
    .channel(`game:${gameId}`)
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'gamestates', 
      filter: `id=eq.${gameId}` 
    }, (payload) => {
      if (payload.new && payload.new.data) {
        onUpdate(payload.new.data);
      }
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const createGame = async (host, settings = {}) => {
  const gameId = Math.random().toString(36).substr(2, 6).toUpperCase();
  
  const newGameData = {
    id: gameId,
    hostId: host.id,
    status: 'lobby',
    settings: settings, // Store settings (e.g., noDuplicates)
    players: [{
      id: host.id,
      name: host.name,
      avatar: host.avatar,
      score: 0,
      isReady: false,
      grid: Array(16).fill(null).map((_, i) => ({ id: `cell-${i}`, song: null, marked: false })),
      bingoCount: 0
    }],
    currentSong: null,
    createdAt: Date.now(),
  };

  const { error } = await supabase
    .from('gamestates')
    .insert({ id: gameId, data: newGameData })
    .select(); 
    
  if (error) throw new Error(`Database Error: ${error.message}`);

  saveCurrentGameId(gameId);
  await addToHistory(newGameData, host.id);
  await updateUserStats(host.id, { games_played: 1 });
  
  return newGameData;
};

export const joinGame = async (gameId, user) => {
  const cleanId = gameId ? gameId.trim().toUpperCase() : '';
  if (!cleanId) return null;

  const { data, error } = await supabase
    .from('gamestates')
    .select('data')
    .eq('id', cleanId)
    .maybeSingle();
  
  if (error || !data) return null;

  let game = data.data;

  if (game.status !== 'finished' && (Date.now() - (game.createdAt || 0) > 24 * 60 * 60 * 1000)) {
      game.status = 'finished';
      await saveGameState(cleanId, game);
  }

  if (user) {
    const playerExists = game.players.some(p => p.id === user.id);
    
    if (!playerExists) {
        game.players.push({
            id: user.id,
            name: user.name,
            avatar: user.avatar,
            score: 0,
            grid: Array(16).fill(null).map((_, i) => ({ id: `cell-${i}`, song: null, marked: false })),
            bingoCount: 0
        });
        await saveGameState(cleanId, game);
        await updateUserStats(user.id, { games_played: 1 });
    }
    saveCurrentGameId(cleanId);
    await addToHistory(game, user.id);
  }

  return game;
};

export const updateGame = async (gameId, updates) => {
  let game = await joinGame(gameId, null); 
  if (!game) return;
  const updatedGame = { ...game, ...updates };
  await saveGameState(gameId, updatedGame);
};

export const finishGame = async (gameId) => {
    let game = await joinGame(gameId, null);
    if(!game) return;
    
    await updateGame(gameId, { status: 'finished' });
    
    const winners = game.players.sort((a, b) => b.score - a.score);
    if (winners.length > 0) {
        const winnerId = winners[0].id;
        await updateUserStats(winnerId, { games_won: 1 });
    }

    // Force update history locally for players currently connected
    // In a real app, we would use Realtime on profiles table or similar.
    // Here, rely on lobby logic.
};

export const updatePlayerGrid = async (gameId, playerId, grid, newSong = null) => {
  let game = await joinGame(gameId, null);
  if (!game) return;

  const playerIndex = game.players.findIndex(p => p.id === playerId);
  if (playerIndex !== -1) {
    game.players[playerIndex].grid = grid;
    recalculatePlayerScore(game.players[playerIndex]);
    await saveGameState(gameId, game);

    if (newSong) {
        await incrementSongPlayCount(newSong);
        await updateUserStats(playerId, { songs_chosen: 1 });
        await updatePersonalSongStats(playerId, newSong, 'select');
    }
  }
};

export const toggleGlobalSong = async (gameId, songId, newState) => {
  let game = await joinGame(gameId, null);
  if (!game) return;

  let changesMade = false;
  let validatedForFirstTimeInGame = false;

  game.players.forEach(player => {
    let playerChanged = false;
    let bingoBefore = player.bingoCount || 0;
    
    player.grid.forEach(cell => {
      if (cell.song && cell.song.id === songId) {
         if (cell.marked !== newState) {
             cell.marked = newState;
             playerChanged = true;
             changesMade = true;
             
             // Track Stats: If we are marking it (Validating)
             if (newState) {
                 updatePersonalSongStats(player.id, cell.song, 'validate');
                 validatedForFirstTimeInGame = true;
             }
         }
      }
    });

    if (playerChanged) {
        recalculatePlayerScore(player);
        if ((player.bingoCount || 0) > bingoBefore) {
             updateUserStats(player.id, { bingos: 1 });
        }
    }
  });

  if (changesMade) {
      await saveGameState(gameId, game);
      if (validatedForFirstTimeInGame && newState) {
          incrementSongValidationCount(songId);
      }
  }
};

const recalculatePlayerScore = (player) => {
    const bingoCount = calculateBingo(player.grid);
    const previousBingo = player.bingoCount || 0;
    if (bingoCount > previousBingo) {
        player.score += (bingoCount - previousBingo) * 100;
    }
    player.bingoCount = bingoCount;
};

const saveGameState = async (gameId, gameData) => {
    await supabase.from('gamestates').update({ data: gameData }).eq('id', gameId);
};

const calculateBingo = (grid) => {
  let lines = 0;
  const size = 4;
  for (let i = 0; i < size; i++) {
    if (grid.slice(i * size, (i + 1) * size).every(c => c.marked)) lines++; 
  }
  for (let i = 0; i < size; i++) {
    let colFull = true;
    for (let j = 0; j < size; j++) {
      if (!grid[j * size + i].marked) colFull = false;
    }
    if (colFull) lines++;
  }
  if ([0, 5, 10, 15].every(i => grid[i].marked)) lines++;
  if ([3, 6, 9, 12].every(i => grid[i].marked)) lines++;
  return lines;
};
