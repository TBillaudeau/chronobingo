
import { supabase } from '../lib/supabase';

// Storage Keys (Client side cache)
const USER_KEY = 'disco_bingo_user';
const CURRENT_GAME_KEY = 'disco_bingo_current_game';
const GUEST_HISTORY_KEY = 'disco_bingo_guest_history';

// --- 1. Auth & User Management ---

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

export const removeLocalUser = () => {
  if (typeof window !== 'undefined') {
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

// Sync user to DB (Upsert) - Data Minimization: Only ID, Name, Avatar
export const saveUserToDb = async (user) => {
  if (!user) return;

  saveLocalUser(user);

  // Guest logic is ephemeral, but we store basic info for multiplayer consistency
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      name: user.name, // First name only as processed by MainGame
      avatar: user.avatar,
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
    achievements: data?.achievements || [],
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

export const deleteUserAccount = async (userId) => {
  if (!userId) return;

  // Call our new API route
  const response = await fetch('/api/delete-account', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to delete account');
  }

  // Logout locally
  await logoutUser();
};

// --- 2. Favorites, Stats & Achievements ---

export const ACHIEVEMENTS = [
  { id: 'first_bingo', icon: '🎉', condition: (p) => p.stats.bingos >= 1 },
  { id: 'beginner_luck', icon: '🍀', condition: (p) => p.stats.games_won >= 1 && p.stats.games_played <= 5 },
  { id: '10_wins', icon: '🏆', condition: (p) => p.stats.games_won >= 10 }
];

const checkAchievements = async (userId, profile) => {
  const currentAchievements = profile.achievements || [];
  const newAchievements = [];

  ACHIEVEMENTS.forEach(ach => {
    // If not already unlocked and condition met
    if (!currentAchievements.some(a => a.id === ach.id) && ach.condition(profile)) {
      newAchievements.push({ id: ach.id, unlockedAt: Date.now() });
    }
  });

  if (newAchievements.length > 0) {
    const finallist = [...currentAchievements, ...newAchievements];

    // TODO: Enable this after adding 'achievements' (jsonb) column to the 'profiles' table in Supabase.
    // Currently causing PGRST204 error (column not found).
    // const { error } = await supabase.from('profiles').update({ achievements: finallist }).eq('id', userId);

    // if (error) {
    //    console.warn("Failed to update achievements:", error);
    // }

    return newAchievements;
  }
  return [];
};

export const updateUserStats = async (userId, updates) => {
  if (userId.startsWith('guest-')) return;

  // Fetch current stats safely
  const profile = await getUserProfile(userId);
  const currentStats = profile.stats;

  const newStats = {
    games_played: (currentStats.games_played || 0) + (updates.games_played || 0),
    games_won: (currentStats.games_won || 0) + (updates.games_won || 0),
    songs_chosen: (currentStats.songs_chosen || 0) + (updates.songs_chosen || 0),
    bingos: (currentStats.bingos || 0) + (updates.bingos || 0)
  };

  // Use upsert to ensure it writes even if row somehow missing
  await supabase.from('profiles').upsert({ id: userId, stats: newStats, updated_at: new Date() });

  // Check achievements with the NEW stats
  await checkAchievements(userId, { ...profile, stats: newStats });
};

// Helper to update the nested JSONB "song_stats"
const updatePersonalSongStats = async (userId, song, action, count = 1) => {
  if (!song || !song.id || userId.startsWith('guest-')) return;

  const profile = await getUserProfile(userId);
  let stats = profile.song_stats || {};

  const sId = song.id.toString();
  if (!stats[sId]) {
    stats[sId] = { title: song.title, selected: 0, validated: 0 };
  }

  if (action === 'select') stats[sId].selected += count;
  if (action === 'validate') stats[sId].validated += count;

  // Prevent negative values
  if (stats[sId].selected < 0) stats[sId].selected = 0;
  if (stats[sId].validated < 0) stats[sId].validated = 0;

  const { error } = await supabase.from('profiles').upsert({ id: userId, song_stats: stats, updated_at: new Date() });
  if (error) console.error("Error updating song stats:", error);
};

export const toggleFavorite = async (userId, song) => {
  if (userId.startsWith('guest-')) return [];

  const profile = await getUserProfile(userId);
  // Safe fallback to empty array if null
  let favs = profile.favorites || [];

  const exists = favs.find(f => f.id === song.id);

  if (exists) {
    favs = favs.filter(f => f.id !== song.id);
  } else {
    favs = [...favs, song];
  }

  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    favorites: favs,
    updated_at: new Date()
  });

  if (error) console.error("Error saving favorites:", error);
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

export const incrementSongValidationCount = async (songId, change = 1) => {
  if (!songId) return;
  const { data: existing } = await supabase
    .from('global_songs')
    .select('validation_count')
    .eq('id', songId.toString())
    .maybeSingle();

  if (existing) {
    // Ensure we don't go below zero
    const newCount = Math.max(0, (existing.validation_count || 0) + change);
    await supabase
      .from('global_songs')
      .update({ validation_count: newCount })
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

const addToHistory = async (game, userId, overrides = {}) => {
  if (!userId || !game) return;

  // Retrieve existing history first to preserve isSaved if not overridden
  let existingIsSaved = false;
  let history = [];

  if (userId.startsWith('guest-')) {
    try {
      const stored = localStorage.getItem(GUEST_HISTORY_KEY);
      if (stored) history = JSON.parse(stored);
    } catch (e) { }
  } else {
    const profile = await getUserProfile(userId);
    history = profile.history || [];
  }

  const existingEntry = history.find(h => h.id === game.id);
  if (existingEntry) {
    existingIsSaved = existingEntry.isSaved || false;
  }

  // Determine final isSaved: overrides > existing > default (false)
  // Note: We don't use game.isSaved anymore as it is not global
  const finalIsSaved = overrides.hasOwnProperty('isSaved') ? overrides.isSaved : existingIsSaved;

  const summary = {
    id: game.id,
    hostName: game.players.find(p => p.id === game.hostId)?.name || 'Unknown',
    date: Date.now(), // Or preserve original date? Ideally update date on active changes, keep on save? Let's refresh date for now as it means "last interaction"
    status: game.status,
    myScore: game.players.find(p => p.id === userId)?.score || 0,
    isSaved: finalIsSaved,
    userId: userId
  };

  // Filter out old entry
  history = history.filter(h => h.id !== game.id);

  // If preserved/saved or just active interaction, keep it.
  // The 'save' feature implies prevention of auto-cleanup or manual deletion (if implemented that way),
  // but here it is just a flag.
  history.unshift(summary);

  // Limit history length, BUT don't drop SAVED games if we can avoid it? 
  // For now, simple slice.
  history = history.slice(0, 20);

  if (userId.startsWith('guest-')) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(history));
    }
    return;
  }

  // Real User
  const { error } = await supabase.from('profiles').update({
    history: history,
    updated_at: new Date()
  }).eq('id', userId);

  if (error) {
    console.warn("Failed to save game history:", error);
  }
};

// ...

export const toggleSaveGame = async (gameId, shouldSave, userId = null) => {
  let game = await joinGame(gameId, null);
  if (!game) return;

  // Do NOT update global game state for saving. It is personal.
  // game.isSaved = shouldSave; 
  // await saveGameState(gameId, game); 

  // Update history directly
  if (userId) {
    await addToHistory(game, userId, { isSaved: shouldSave });
  }
};

// ...



const removeFromHistory = async (gameId, userId) => {
  if (!userId || !gameId) return;

  // 1. Guest
  if (userId.startsWith('guest-')) {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(GUEST_HISTORY_KEY);
      if (stored) {
        let localHistory = JSON.parse(stored);
        localHistory = localHistory.filter(h => h.id !== gameId);
        localStorage.setItem(GUEST_HISTORY_KEY, JSON.stringify(localHistory));
      }
    } catch (e) { }
    return;
  }

  // 2. Real User
  const profile = await getUserProfile(userId);
  let history = profile.history || [];

  const initialLength = history.length;
  history = history.filter(h => h.id !== gameId);

  if (history.length !== initialLength) {
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      history: history,
      updated_at: new Date()
    });
    if (error) console.error("Error removing history:", error);
  }
};

export const getGameHistory = async (userId) => {
  if (userId && userId.startsWith('guest-')) {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(GUEST_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) { return []; }
  }

  // Real User - getUserProfile guarantees an array return
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
      isGridLocked: false,
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

  // --- AUTO-CLEANUP TRIGGER (OPPORTUNISTIC) ---
  // Every time a game is created, there is a 10% chance we trigger the cleanup routine.
  // We do NOT await this, we let it run in the background (fire and forget).
  if (Math.random() < 0.1) {
    fetch('/api/cleanup').catch(e => console.warn("Background cleanup trigger failed:", e));
  }

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
        isGridLocked: false,
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
  if (!game) return;

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

// Individual cell marking (No global sync)
export const togglePlayerCell = async (gameId, playerId, cellId, newState) => {
  let game = await joinGame(gameId, null);
  if (!game) return;

  const player = game.players.find(p => p.id === playerId);
  if (!player) return;

  const cell = player.grid.find(c => c.id === cellId);
  if (!cell || !cell.song) return; // Can only mark if there is a song

  let bingoBefore = player.bingoCount || 0;

  if (cell.marked !== newState) {
    cell.marked = newState;

    // Stats & Leaderboard
    // Handle validation counts (increment or decrement) based on toggle
    const valChange = newState ? 1 : -1;

    // 1. Update Personal Stats in Supabase Profile
    updatePersonalSongStats(player.id, cell.song, 'validate', valChange);

    // 2. Update Global Song Validation Count (if needed, but personal sum covers it)
    // incrementSongValidationCount currently just +1, let's assume we fix it or leave it if it only tracks 'ever marked'.
    // User asked "take into account when people check uncheck".
    incrementSongValidationCount(cell.song.id, valChange);


    recalculatePlayerScore(player);

    if ((player.bingoCount || 0) > bingoBefore) {
      updateUserStats(player.id, { bingos: 1 });
    }

    await saveGameState(gameId, game);
  }
};

const recalculatePlayerScore = (player) => {
  let score = 0;
  let lines = 0;
  const grid = player.grid;
  const size = 4;

  // 1. Base Score: 1 point per marked song
  let markedCount = 0;
  grid.forEach(cell => {
    if (cell.marked) {
      score += 1;
      markedCount++;
    }
  });

  // 2. Line Bonus: 10 points per Row/Column (No Diagonals)
  // Rows
  for (let i = 0; i < size; i++) {
    if (grid.slice(i * size, (i + 1) * size).every(c => c.marked)) {
      score += 10;
      lines++;
    }
  }
  // Columns
  for (let i = 0; i < size; i++) {
    let colFull = true;
    for (let j = 0; j < size; j++) {
      if (!grid[j * size + i].marked) colFull = false;
    }
    if (colFull) {
      score += 10;
      lines++;
    }
  }

  // 3. Full Card Bonus: +50 points (Total 16 cells marked)
  if (markedCount === 16) {
    score += 50;
  }

  player.score = score;
  player.bingoCount = lines; // We still track lines for "BINGO!" animations
};

const saveGameState = async (gameId, gameData) => {
  await supabase.from('gamestates').update({ data: gameData }).eq('id', gameId);
};

// Helper for UI animations only (kept for compatibility if needed elsewhere)
const calculateBingo = (grid) => {
  let lines = 0;
  const size = 4;
  // Rows
  for (let i = 0; i < size; i++) {
    if (grid.slice(i * size, (i + 1) * size).every(c => c.marked)) lines++;
  }
  // Columns
  for (let i = 0; i < size; i++) {
    let colFull = true;
    for (let j = 0; j < size; j++) {
      if (!grid[j * size + i].marked) colFull = false;
    }
    if (colFull) lines++;
  }
  return lines;
};

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



export const removePlayer = async (gameId, playerId) => {
  let game = await joinGame(gameId, null);
  if (!game) return;

  const initialPlayerCount = game.players.length;
  game.players = game.players.filter(p => p.id !== playerId);

  if (game.players.length !== initialPlayerCount) {
    // If the host leaves, assign new host if players remain
    if (game.hostId === playerId && game.players.length > 0) {
      game.hostId = game.players[0].id;
    }

    await saveGameState(gameId, game);
    await removeFromHistory(gameId, playerId);
  }
};

