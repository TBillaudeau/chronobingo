import { useState, useRef, useEffect } from 'react';

export const useAudioPlayer = () => {
    const [playingUrl, setPlayingUrl] = useState(null);
    const audioRef = useRef(null);

    const toggleAudio = (url) => {
        if (!url) return;

        if (playingUrl === url) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingUrl(null);
        } else {
            if (audioRef.current) audioRef.current.pause();

            try {
                const audio = new Audio(url);
                audio.volume = 0.5;
                audio.onended = () => setPlayingUrl(null);

                const playPromise = audio.play();
                if (playPromise !== undefined) {
                    playPromise.catch(e => {
                        console.warn("Audio playback failed (likely empty or invalid source):", e.message);
                        setPlayingUrl(null); // Reset UI state on failure
                    });
                }

                audioRef.current = audio;
                setPlayingUrl(url);
            } catch (err) {
                console.warn("Could not initialize Audio:", err);
            }
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
