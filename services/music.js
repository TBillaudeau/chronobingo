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

export const getTrendingSongs = async () => {
  try {
    const response = await fetch(`${API_PROXY}?path=/chart/0/tracks&limit=10`);
    if (!response.ok) throw new Error('Network error');

    const data = await response.json();
    if (!data.data) return FALLBACK_SONGS;

    return data.data.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist.name,
      cover: track.album.cover_medium,
      preview: track.preview
    }));
  } catch (error) {
    console.warn("Trending fetch failed", error);
    return FALLBACK_SONGS;
  }
};

export const getTopPartySongs = async () => {
  return new Promise(resolve => {
    setTimeout(() => resolve(FALLBACK_SONGS), 500);
  });
};