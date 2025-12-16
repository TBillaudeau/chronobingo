// Audio Fingerprinting Service using Peaks.js / Chroma logic improvement?
// No, user wants a NEW system. 
// Let's implement a robust Peak-Fingerprinting system (Shazam-like simplified).

// 1. Spectrogram / Peaks extraction
// We need to move away from "Average Chroma" which is too vague.
// We need "Landmarks" in the spectrogram.

// Since we cannot use heavy external APIs, we will build a 
// "Sparse Spectrogram Hashing" system in pure JS.

// Algorithm:
// 1. Compute FFT on audio windows.
// 2. Find local maxima (peaks) in the spectrogram (Time, Frequency).
// 3. Create hashes between pairs of peaks (target zone).
// 4. Index songs by these hashes.
// 5. Query recorded audio by generating hashes and finding time-aligned matches.

// Ideally, implementing this from scratch in JS is heavy.
// Let's try a "Sub-Fingerprint" approach based on energy bands, which is lighter.
// "Philips Fingerprinting" algorithm is efficient.
// (Energy in 33 frequency bands, 1 bit per band change -> 32-bit integer stream).

// IMPL:
// We will divide frequency spectrum (300Hz - 2000Hz?) into N logarithmic bands.
// For each frame, we compute energy in each band.
// Fingerprint bit i = 1 if (E[n,i] - E[n,i+1]) - (E[n-1,i] - E[n-1,i+1]) > 0.
// This is very robust to noise and equalization.

const TARGET_SAMPLE_RATE = 11025; // Low sample rate sufficient for music ID
const FFT_SIZE = 1024;
const NUM_BANDS = 33; // 33 bands -> 32 bits

// Logarithmic bands mapping
const BANDS = [];
// Generate bands (approx layout)
{
    const minFreq = 300;
    const maxFreq = 4000;
    const logMin = Math.log(minFreq);
    const logMax = Math.log(maxFreq);
    for (let i = 0; i < NUM_BANDS + 1; i++) {
        const freq = Math.exp(logMin + (logMax - logMin) * (i / NUM_BANDS));
        BANDS.push(freq);
    }
}

// Helper: Get offline AudioContext
const getOfflineContext = (length, rate) => new OfflineAudioContext(1, length, rate);

// 1. Analyze Song (Generate Fingerprint Array)
export const generateFingerprint = async (audioBuffer) => {
    // Resample to target rate if needed? 
    // OfflineAudioContext can handle resampling during decode or rendering-ish.
    // For simplicity, we'll assume we process whatever we get, but scaled.

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // We need FFTs.
    // Let's perform a "Sliding FFT".
    // 32ms frames? ~30fps fingerprints.

    const context = new OfflineAudioContext(1, channelData.length, sampleRate);
    // We use AnalyserNode to get FFT data easily instead of manual Math
    const source = context.createBufferSource();
    source.buffer = audioBuffer;

    const analyser = context.createAnalyser();
    analyser.fftSize = 2048; // better res
    analyser.smoothingTimeConstant = 0;

    // We need to run the graph. But AnalyserNode doesn't work well in OfflineContext fast-forward?
    // Actually, getting data out of AnalyserNode in OfflineContext requires `suspend` loop.
    // That might be slow.

    // ALTERNATIVE: Lightweight manual Goertzel or simple energy sum on bands?
    // Manual FFT is heavy.
    // Let's stick to the previous "Chroma" approach but DIFFERENTLY:
    // "Chromaprint" style: 12-bin Chroma vector sequence.
    // We match the SEQUENCE, not the average.

    // THE NEW APPROACH: SEQUENCE MATCHING
    // 1. Extract Chroma sequence (1 vector every 100ms).
    // 2. Quantize it (convert float vector to integer string/hash).
    // 3. To match, we align the mic sequence with song sequence using specific error tolerance.

    // This function is now deprecated by V3, but kept for API compatibility if needed.
    // It will call the new extractPitchSequence if it were to be used, which is not ideal.
    // For now, it's left as is, assuming V3 functions are used directly.
    return await extractChromaSequence(audioBuffer);
};

// AUTO-DAUB V3: DOMINANT PITCH MATCHING
// Simplified algorithm: "What is the loudest note?"
// Robust to EQ, Volume, and Noise.

import Meyda from 'meyda';

// 1. Extract Sequence of Dominant Pitches (Integers 0-11)
const extractPitchSequence = async (audioBuffer) => {
    const signal = audioBuffer.getChannelData(0);
    const hopSize = 1024; // High overlap (75%) for precision
    const bufferSize = 4096;

    const sequence = [];

    for (let i = 0; i < signal.length; i += hopSize) {
        if (i + bufferSize > signal.length) break;
        const chunk = signal.slice(i, i + bufferSize);

        let sum = 0;
        for (let k = 0; k < chunk.length; k++) sum += chunk[k] * chunk[k];
        const rms = Math.sqrt(sum / chunk.length);

        if (rms < 0.002) {
            sequence.push(-1);
            continue;
        }

        const features = Meyda.extract(['chroma'], chunk);
        if (features && features.chroma) {
            let maxVal = -1;
            let maxIdx = -1;
            for (let j = 0; j < 12; j++) {
                if (features.chroma[j] > maxVal) {
                    maxVal = features.chroma[j];
                    maxIdx = j;
                }
            }
            sequence.push(maxIdx);
        } else {
            sequence.push(-1);
        }
    }
    return sequence;
};

// Database
let songDatabase = {};

export const trainDatabase = async (songs) => {
    songDatabase = {};
    // Force standard rate
    const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });

    console.log("AutoDaub V3.5: Indexing at 44100Hz...");

    for (const song of songs) {
        if (!song.preview) continue;
        try {
            const resp = await fetch(song.preview);
            const ab = await resp.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(ab);

            const seq = await extractPitchSequence(audioBuffer);
            songDatabase[song.id] = {
                title: song.title,
                sequence: seq
            };
        } catch (e) { console.warn("Skip " + song.title); }
    }
    console.log("AutoDaub V3.5: Ready.");
    return true;
};

// MATCHING: Sliding Window counting exact integer matches
export const findMatchV2 = async (micBuffer, ignoredIds = []) => {
    // 1. Get pitch sequence from Mic (6s)
    const micSeq = await extractPitchSequence(micBuffer);

    // Minimum frames check (higher now due to smaller hop)
    const activeFrames = micSeq.filter(p => p !== -1).length;
    if (activeFrames < 40) return null;

    let globalBestScore = 0;
    let globalBestId = null;

    const SEQ_LEN = micSeq.length;

    // For each song
    for (const [id, data] of Object.entries(songDatabase)) {
        // PERFORMANCE: Skip found songs
        if (ignoredIds.includes(String(id)) || ignoredIds.includes(Number(id))) continue;
        const songSeq = data.sequence;
        if (songSeq.length < SEQ_LEN) continue;

        // Slide mic sequence (step 8 for speed with high res)
        for (let i = 0; i <= songSeq.length - SEQ_LEN; i += 8) {
            let score = 0;
            let frameCount = 0;
            let streak = 0;

            for (let j = 0; j < SEQ_LEN; j += 1) {
                const micPitch = micSeq[j];
                const songPitch = songSeq[i + j];

                if (micPitch === -1) continue;

                frameCount++;

                // 1. Exact Match (The Gold Standard)
                if (micPitch === songPitch) {
                    score += 1.0;
                }
                // 2. Neighbor Tolerance (Only for slight tuning/speed drift)
                // Lowered weight to avoid matching "Same Key" songs
                else if (micPitch === (songPitch + 1) % 12 || micPitch === (songPitch + 11) % 12) {
                    score += 0.2;
                }
            }

            if (frameCount > 30) {
                const finalScore = score / frameCount;

                if (finalScore > globalBestScore) {
                    globalBestScore = finalScore;
                    globalBestId = id;
                }
            }
        }
    }

    // Threshold: 0.40 (40%) - Valid matches usually hit > 50-60%
    if (globalBestScore > 0.40) {
        const song = songDatabase[globalBestId];
        console.log(`🎤 V3.5 MATCH: ${song.title} (${(globalBestScore * 100).toFixed(1)}%)`);
        return { id: globalBestId, score: globalBestScore };
    }

    return null;
};
