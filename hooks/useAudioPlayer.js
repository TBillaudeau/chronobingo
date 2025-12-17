import { useState, useRef, useEffect } from 'react';
import { refreshSongUrl } from '../services/music';
import { updateSongPreview } from '../services/gameService';

export const useAudioPlayer = (onSongUpdate) => {
    const [playingUrl, setPlayingUrl] = useState(null);
    const [playingId, setPlayingId] = useState(null);
    const audioRef = useRef(null);

    const toggleAudio = async (song, manualUrl = null) => {
        let targetSong = song;
        if (song && song.stopPropagation) {
            song.stopPropagation();
            targetSong = manualUrl;
        }

        const url = targetSong?.preview || targetSong;
        const id = targetSong?.id || null;

        if (!url) return;

        // Check match by URL OR ID (robustness)
        const isSame = (playingUrl === url) || (id && playingId === id);

        if (isSame) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingUrl(null);
            setPlayingId(null);
        } else {
            if (audioRef.current) audioRef.current.pause();

            const play = async (src) => {
                const audio = new Audio(src);
                audio.volume = 0.5;
                try {
                    await audio.play();
                    audioRef.current = audio;
                    setPlayingUrl(src);
                    setPlayingId(id);
                    audio.onended = () => {
                        setPlayingUrl(null);
                        setPlayingId(null);
                    };
                } catch (err) {
                    console.warn("Audio Play Error:", err);
                    // Always try to refresh if we have an ID
                    if (typeof targetSong === 'object' && targetSong.id) {


                        const currentBadUrl = targetSong?.preview || targetSong;
                        const freshUrl = await refreshSongUrl(targetSong.id, currentBadUrl);

                        if (freshUrl && freshUrl !== src) {
                            updateSongPreview(targetSong.id, freshUrl);
                            if (onSongUpdate) {
                                onSongUpdate(targetSong.id, freshUrl);
                            } else {
                                targetSong.preview = freshUrl;
                            }
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

    return { playingUrl, playingId, toggleAudio };
};
