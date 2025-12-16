import { useState, useRef, useEffect } from 'react';
import { refreshSongUrl } from '../services/music';
import { updateSongPreview } from '../services/gameService';

export const useAudioPlayer = (onSongUpdate) => {
    const [playingUrl, setPlayingUrl] = useState(null);
    const audioRef = useRef(null);

    const toggleAudio = async (song, manualUrl = null) => {
        // Support both (song object) and (e, song) signature or just (url) if strictly needed
        // But for robust logic we need the SONG OBJECT (id, title, preview).
        // If the first arg is an event (from onClick), ignore it or use 2nd arg.

        let targetSong = song;
        if (song && song.stopPropagation) {
            // It's an event, assume 2nd arg is the song/url
            targetSong = manualUrl;
        }

        const url = targetSong?.preview || targetSong;
        if (!url) return;

        if (playingUrl === url) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingUrl(null);
        } else {
            if (audioRef.current) audioRef.current.pause();

            const play = async (src) => {
                const audio = new Audio(src);
                audio.volume = 0.5;
                try {
                    await audio.play();
                    audioRef.current = audio;
                    setPlayingUrl(src);
                    audio.onended = () => setPlayingUrl(null);
                } catch (err) {
                    console.warn("Audio Play Error:", err);
                    // Check if eligible for refresh
                    if ((err.name === 'NotSupportedError' || err.name === 'NotAllowedError') && typeof targetSong === 'object' && targetSong.id) {
                        console.log("♻️ Auto-repairing song URL:", targetSong.title);
                        const freshUrl = await refreshSongUrl(targetSong.id);

                        if (freshUrl && freshUrl !== src) {
                            // 1. Update Global Cache
                            updateSongPreview(targetSong.id, freshUrl);

                            // 2. Notify Parent to Update Local State
                            if (onSongUpdate) {
                                onSongUpdate(targetSong.id, freshUrl);
                            } else {
                                // Fallback mutation if no callback provided (works for simple cases)
                                targetSong.preview = freshUrl;
                            }

                            // 3. Retry Play
                            play(freshUrl);
                        }
                    }
                }
            };
            play(url);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) audioRef.current.pause();
        };
    }, []);

    return { playingUrl, toggleAudio };
};
