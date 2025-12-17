// Using local Next.js API proxy to avoid CORS and 403 errors
const API_PROXY = '/api/deezer';

// Fallback data in case API fails
const FALLBACK_SONGS = [
  { id: 101, title: "Uptown Funk", artist: "Mark Ronson", cover: "https://e-cdns-images.dzcdn.net/images/cover/f243260618c83b70195655497d254d62/250x250-000000-80-0-0.jpg", preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6d07e95d77-5.mp3", plays: 11500 },
  { id: 123, title: "I Will Survive", artist: "Gloria Gaynor", cover: "https://e-cdns-images.dzcdn.net/images/cover/45e97c54c24e41d79c0f3e6e22df8e1c/250x250-000000-80-0-0.jpg", preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6d07e95d77-5.mp3", plays: 15420 },
  { id: 789, title: "Dancing Queen", artist: "ABBA", cover: "https://e-cdns-images.dzcdn.net/images/cover/d86a6016e558185d0eb8c17d4737737f/250x250-000000-80-0-0.jpg", preview: "https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9e9e880d2c6d07e95d77-5.mp3", plays: 12890 },
];

export const searchSongs = async (query) => {
  if (!query || query.length < 2) return [];

  try {
    const response = await fetch(`${API_PROXY}?path=/search&q=${encodeURIComponent(query)}&limit=20`);
    if (!response.ok) throw new Error('Network error');

    const data = await response.json();

    if (!data.data) return [];

    return data.data.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      cover: track.album.cover_medium,
      preview: track.preview
    }));
  } catch (error) {
    console.warn("Deezer search failed, using fallback", error);
    return FALLBACK_SONGS.filter(s => s.title.toLowerCase().includes(query.toLowerCase()));
  }
};

// Basic in-memory cache
let trendingCache = null;
let trendingCacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 10; // 10 minutes cache

export const getTrendingSongs = async () => {
  const now = Date.now();
  if (trendingCache && (now - trendingCacheTime < CACHE_DURATION)) {
    return trendingCache;
  }

  try {
    const response = await fetch(`${API_PROXY}?path=/chart/0/tracks&limit=50`);
    if (!response.ok) throw new Error('Network error');

    const data = await response.json();

    if (!data.data) return FALLBACK_SONGS;

    const songs = data.data.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      cover: track.album.cover_medium,
      preview: track.preview
    }));

    // Update Cache
    trendingCache = songs;
    trendingCacheTime = now;

    return songs;
  } catch (error) {
    console.warn("Trending fetch failed", error);
    return FALLBACK_SONGS;
  }
};

export const refreshSongUrl = async (songId, knownBadUrl = null) => {
  if (!songId) return null;

  try {
    // 1. Check Global DB Cache first (optimistic check against other users' updates)
    if (knownBadUrl) {
      const { data: globalEntry } = await supabase
        .from('global_songs')
        .select('preview')
        .eq('id', songId.toString())
        .maybeSingle();

      if (globalEntry && globalEntry.preview && globalEntry.preview !== knownBadUrl) {
        return globalEntry.preview;
      }
    }

    // 2. Fetch from Deezer API
    const response = await fetch(`${API_PROXY}?path=/track/${songId}`);
    if (!response.ok) throw new Error('Network error');
    const data = await response.json();
    if (data && data.preview) {
      return data.preview;
    }
    return null;
  } catch (error) {
    console.warn("Failed to refresh song URL:", error);
    return null;
  }
};

import { supabase } from '../lib/supabase';

export const getTopPartySongs = async () => {
  try {
    // Fetch all user profiles with their song stats
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('song_stats');

    if (error) throw error;

    // Aggregate stats across all users
    const songMap = {};

    profiles.forEach(p => {
      if (p.song_stats) {
        Object.values(p.song_stats).forEach(songStat => {
          // Only count VALIDATED (marked) usages, effectively "checked/played" songs
          // The user requested: "les chansons cochées pas juste mises"
          if (songStat.validated > 0) {
            if (!songMap[songStat.id]) {
              songMap[songStat.id] = { ...songStat, validated: 0 };
            }
            // We sum up the 'validated' count (how many times it was checked)
            songMap[songStat.id].validated += songStat.validated;
          }
        });
      }
    });

    // Convert to array, sort by validation count, take top 5
    const topSongs = Object.values(songMap)
      .sort((a, b) => b.validated - a.validated)
      .slice(0, 5); // Limit to 5 as requested

    return topSongs;

  } catch (err) {
    console.warn("Top Songs fetch failed:", err);
    return FALLBACK_SONGS;
  }
};