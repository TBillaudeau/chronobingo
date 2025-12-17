import Meyda from 'meyda';
import { refreshSongUrl } from './music';
import { updateSongPreview } from './gameService';

// Audio Worklet Processor Code (Moved from component to service)
export const CAPTURE_PROCESSOR_CODE = `
class CaptureProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.samplesCollected = 0;
        this.bufferSize = sampleRate * 6; // Increase to 6s for better matching context 
        this.buffer = new Float32Array(this.bufferSize);
        this.lastLog = currentTime;
    }
    process(inputs) {
        const input = inputs[0];
        if (!input || !input.length) return true;
        
        // Debug Logs
        if (currentTime - this.lastLog > 3.0) {
                this.port.postMessage({ type: 'log', message: 'V2 Worklet Alive' });
                this.lastLog = currentTime;
        }

        const channelData = input[0];
        
        if (this.samplesCollected + channelData.length > this.bufferSize) {
            this.port.postMessage(this.buffer); // Send full buffer
            this.samplesCollected = 0; 
        }
        
        this.buffer.set(channelData, this.samplesCollected);
        this.samplesCollected += channelData.length;
        return true;
    }
}
registerProcessor('capture-processor', CaptureProcessor);
`;

// AUTO-DAUB V3: DOMINANT PITCH MATCHING
// Simplified algorithm: "What is the loudest note?"
// Robust to EQ, Volume, and Noise.

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

    // console.log("AutoDaub V3.5: Indexing at 44100Hz...");

    for (const song of songs) {
        if (!song.preview) continue;
        try {
            let resp = await fetch(song.preview);

            // AUTO REPAIR LOGIC
            if (!resp.ok) {
                console.warn(`⚠️ Training Fetch Error (${resp.status}) for: ${song.title}. Attempting repair...`);
                // Use the robust refresher we built
                const freshUrl = await refreshSongUrl(song.id, song.preview);

                if (freshUrl) {
                    // Try again with fresh URL
                    resp = await fetch(freshUrl);
                    if (resp.ok) {
                        // console.log(`✅ Repaired & Indexed: ${song.title}`);
                        // Update the song object in-place so future calls use it
                        song.preview = freshUrl;
                        // Persist the fix globally to help others
                        updateSongPreview(song.id, freshUrl);
                    } else {
                        throw new Error(`Repaired URL also failed: ${resp.status}`);
                    }
                } else {
                    throw new Error(`Could not refresh URL`);
                }
            }

            const ab = await resp.arrayBuffer();
            const audioBuffer = await ctx.decodeAudioData(ab);

            const seq = await extractPitchSequence(audioBuffer);
            songDatabase[song.id] = {
                title: song.title,
                sequence: seq
            };
        } catch (e) {
            // console.warn("Skip " + song.title, e.message); 
        }
    }
    // console.log("AutoDaub V3.5: Ready.");
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
        // console.log(`🎤 V3.5 MATCH: ${song.title} (${(globalBestScore * 100).toFixed(1)}%)`);
        return { id: globalBestId, score: globalBestScore };
    }

    return null;
};
