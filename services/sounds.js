export const playClickSound = () => {
    if (typeof window === 'undefined') return;

    // Simple high-pitch tick
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.05);
    } catch (e) { }
};

export const playSuccessSound = () => {
    if (typeof window === 'undefined') return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();

        // Success chord (C major approx)
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(freq, audioCtx.currentTime);

            gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3 + (i * 0.1));

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.3 + (i * 0.1));
        });
    } catch (e) { }
};

export const playErrorSound = () => {
    if (typeof window === 'undefined') return;

    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        const audioCtx = new AudioContext();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) { }
};
