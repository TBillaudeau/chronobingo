import { supabase } from '../lib/supabase';

// Storage Keys (Client side cache)
const USER_KEY = 'disco_bingo_user';
const CURRENT_GAME_KEY = 'disco_bingo_current_game'; 
const GUEST_HISTORY_KEY = 'disco_bingo_guest_history';

// --- Small internal helpers ---
const isBrowser = () => typeof window !== 'undefined';
const isGuest = (userId) => !!userId && userId.startsWith('guest-');
const now = () => Date.now();
const safeJsonParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

// --- 1. Auth & User Management ---

export const getLocalUser = () => {
  if (!isBrowser()) return null;
  return safeJsonParse(localStorage.getItem(USER_KEY), null);
};

export const saveLocalUser = (user) => {
  if (isBrowser() && user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
};

export const removeLocalUser = () => {
  if (isBrowser()) {
    localStorage.removeItem(USER_KEY);
  }
};

// Real Google Login
export const loginWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    });
    if (error) throw error;
    return data;
};

// Sync user to DB (Upsert)
export const saveUserToDb = async (user) => {
  if (!user) return;
  
  saveLocalUser(user);

  // Guest logic is ephemeral, but we store basic info for multiplayer consistency
  const { error } = await supabase
    .from('profiles')
    .upsert({
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        is_guest: !!user.isGuest,
        updated_at: new Date()
    }, { onConflict: 'id' });

  if (error) console.error("Profile Sync Error:", error);
};

export const getUserProfile = async (userId) => {
    if (!userId) return null;
    
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
    
    if (error) {
        console.warn("Error fetching profile:", error.message);
        // Return a safe default object instead of null to prevent crashes
        return { 
            id: userId, 
            favorites: [], 
            history: [], 
            stats: { games_played: 0, games_won: 0, songs_chosen: 0, bingos: 0 },
            song_stats: {} 
        };
    }

    // Ensure arrays are not null even if DB returns null
    return {
        ...data,
        favorites: data?.favorites || [],
        history: data?.history || [],
        stats: data?.stats || { games_played: 0, games_won: 0, songs_chosen: 0, bingos: 0 },
        song_stats: data?.song_stats || {}
    };
};

export const logoutUser = async () => {
  if (typeof window === 'undefined') return;
  
  // Clear local
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(CURRENT_GAME_KEY);
  
  // Clear Supabase Auth
  await supabase.auth.signOut();
};

// --- 2. Favorites & Stats Management ---

export const updateUserStats = async (userId, updates) => {
  if (isGuest(userId)) return;

  const profile = await getUserProfile(userId);
  const currentStats = profile.stats;

  const newStats = {
    games_played: (currentStats.games_played || 0) + (updates.games_played || 0),
    games_won: (currentStats.games_won || 0) + (updates.games_won || 0),
    songs_chosen: (currentStats.songs_chosen || 0) + (updates.songs_chosen || 0),
    bingos: (currentStats.bingos || 0) + (updates.bingos || 0),
  };

  await supabase
    .from('profiles')
    .upsert({ id: userId, stats: newStats, updated_at: new Date() });
};

// Helper to update the nested JSONB "song_stats"
const updatePersonalSongStats = async (userId, song, action) => {
  if (!song?.id || isGuest(userId)) return;

  const profile = await getUserProfile(userId);
  const stats = { ...(profile.song_stats || {}) };

  const sId = song.id.toString();
  if (!stats[sId]) {
    stats[sId] = { title: song.title, selected: 0, validated: 0 };
  }

  if (action === 'select') stats[sId].selected += 1;
  if (action === 'validate') stats[sId].validated += 1;

  await supabase
    .from('profiles')
    .upsert({ id: userId, song_stats: stats, updated_at: new Date() });
};

export const toggleFavorite = async (userId, song) => {
  if (isGuest(userId)) return [];

  const profile = await getUserProfile(userId);
  let favs = profile.favorites || [];

  const exists = favs.find((f) => f.id === song.id);
  favs = exists ? favs.filter((f) => f.id !== song.id) : [...favs, song];

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, favorites: favs, updated_at: new Date() });

  if (error) console.error('Error saving favorites:', error);
  return favs;
};

export const getFavorites = async (userId) => {
    if (userId.startsWith('guest-')) return [];
    const profile = await getUserProfile(userId);
    return profile.favorites; // getUserProfile guarantees this is an array
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
    const { data, error } = await supabase
        .from('global_songs')
        .select('*')
        .order('validation_count', { ascending: false })
        .order('play_count', { ascending: false })
        .limit(10);
    
    if (error) {
        console.warn("Leaderboard fetch error (Check RLS?):", error.message);
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

  const summary = {
    id: game.id,
    hostName: game.players.find((p) => p.id === game.hostId)?.name || 'Unknown',
    date: now(),
    status: game.status,
    myScore: game.players.find((p) => p.id === userId)?.score || 0,
    userId,
  };

  if (isGuest(userId)) {
    if (!isBrowser()) return;
    const stored = safeJsonParse(localStorage.getItem(GUEST_HISTORY_KEY), []);
    const localHistory = [{ ...summary }, ...stored.filter((h) => h.id !== game.id)].slice(0, 10);
    localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(localHistory));
    return;
  }

  const profile = await getUserProfile(userId);
  const history = [{ ...summary }, ...(profile.history || []).filter((h) => h.id !== game.id)].slice(0, 20);

  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, history, updated_at: new Date() });

  if (error) console.error('Error saving history:', error);
};

export const getGameHistory = async (userId) => {
  if (isGuest(userId)) {
    if (!isBrowser()) return [];
    return safeJsonParse(localStorage.getItem(GUEST_HISTORY_KEY), []);
  }

  const profile = await getUserProfile(userId);
  return profile.history;
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
  
  // Force allowLateJoin to true always
  const finalSettings = { ...settings, allowLateJoin: true };

  const newGameData = {
    id: gameId,
    hostId: host.id,
    status: 'lobby',
    settings: finalSettings, 
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

  // Auto-expire games after 24h
  if (game.status !== 'finished' && (Date.now() - (game.createdAt || 0) > 24 * 60 * 60 * 1000)) {
      game.status = 'finished';
      await saveGameState(cleanId, game);
  }

  if (user) {
    const playerExists = game.players.some(p => p.id === user.id);
    
    if (!playerExists) {
        // Late join is always allowed now
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
    
    const updatedGame = { ...game, status: 'finished' };
    await saveGameState(gameId, updatedGame);
    
    // Update local history for the host immediately so UI refreshes
    const hostId = game.hostId;
    await addToHistory(updatedGame, hostId);
    
    const winners = game.players.sort((a, b) => b.score - a.score);
    if (winners.length > 0) {
        const winnerId = winners[0].id;
        await updateUserStats(winnerId, { games_won: 1 });
    }
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
