
import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { toBlob } from 'html-to-image';
import confetti from 'canvas-confetti'; // VICTORY ANIMATION

import { updatePlayerGrid, updateGame, subscribeToGame, toggleFavorite, getFavorites, joinGame, removeCurrentGameId, togglePlayerCell, finishGame, updateUserStats, togglePlayerGridLock, removePlayer, toggleSaveGame } from '../services/gameService';
import { searchSongs, getTrendingSongs, refreshSongUrl } from '../services/music';
import { t } from '../services/translations';
import { hapticClick, hapticFeedback, hapticSuccess, hapticError } from '../services/haptics';
import { sendNotification } from '../services/notifications';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { trainDatabase, findMatchV2, CAPTURE_PROCESSOR_CODE } from '../services/autoDaubService';
import Tutorial from './Tutorial';
import JokerRoulette from './JokerRoulette'; // JOKER SYSTEM

// Utility to format remaining time (e.g. "65s" -> "1m 5s" or just "2m")
const formatTime = (ms) => {
    const s = Math.ceil(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.ceil(s / 60)}m`;
};

const ActiveGame = ({ initialGame, currentUser, lang, onGameUpdate, onLeave, onNavigateToProfile }) => {
    const [game, setGame] = useState(initialGame);
    const [isAutoListening, setIsAutoListening] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [detectedMatch, setDetectedMatch] = useState(null); // Moved up for safe access
    const mediaStreamRef = useRef(null);
    const dbReadyRef = useRef(false);
    const matchHistoryRef = useRef({ id: null, count: 0 });

    const [showJokerModal, setShowJokerModal] = useState(false);
    const [jokerCooldown, setJokerCooldown] = useState(0);

    // Status Effects (Timestamps for expiration)
    const [frozenUntil, setFrozenUntil] = useState(0);
    const [blindedUntil, setBlindedUntil] = useState(0);
    const [protectedUntil, setProtectedUntil] = useState(0);
    const [isZombie, setIsZombie] = useState(false); // Persistent until action

    const [now, setNow] = useState(Date.now()); // For countdowns
    const [selectedEffectInfo, setSelectedEffectInfo] = useState(null); // { title, desc, color }

    // Update global timer every second for UI countdowns
    useEffect(() => {
        const i = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(i);
    }, []);

    // Derived states for logic
    const isFrozen = now < frozenUntil;
    const isBlinded = now < blindedUntil;
    const isProtected = now < protectedUntil;

    const handleApplyJoker = (joker) => {
        hapticFeedback();

        switch (joker.id) {
            case 'wildcard':
                // PASSE-PARTOUT: Auto-checks a random unmasked cell (Super Sniper)
                const emptyCells = myPlayer.grid.filter(c => c.song && !c.marked);
                if (emptyCells.length > 0) {
                    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                    handleCellClick(randomCell, -1);
                    sendNotification(`🃏 ${myPlayer.name} a utilisé un Passe-Partout!`);
                } else {
                    alert("Grille déjà complète ! Joker gâché.");
                }
                break;

            case 'remix':
                // REMIX: Shuffle un-marked cells visual position locally
                // Note: Changing actual grid index requires DB update. Visual only for MVP or full swap.
                // Let's do full swap logic locally + Optimistic update
                const newGrid = [...myPlayer.grid];
                // Fisher-Yates shuffle
                for (let i = newGrid.length - 1; i > 0; i--) {
                    // Only swap if NOT marked (keep marked structure intact or chaos? Description says "non cochées")
                    // If we shuffle only non-marked, we need to extract them, shuffle, put back. 
                    // Simpler MVP: Shuffle ALL for now, or just notify.
                    // Let's shuffle ALL to be safe with React keys for now, it's a remix after all.
                    const j = Math.floor(Math.random() * (i + 1));
                    [newGrid[i], newGrid[j]] = [newGrid[j], newGrid[i]];
                }
                // We need to commit this to GameService ideally. 
                // For MVP, we update local game state optimistically.
                const updatedPlayer = { ...myPlayer, grid: newGrid };
                const updatedPlayers = game.players.map(p => p.id === currentUser.id ? updatedPlayer : p);
                setGame({ ...game, players: updatedPlayers });
                // Also trigger DB update if possible (TODO)
                updatePlayerGrid(game.id, currentUser.id, newGrid).catch(console.error);
                break;

            case 'cryo':
                // CRYO-GUN: Freeze top player
                const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
                const target = sortedPlayers[0];
                if (target.id === currentUser.id) {
                    // Backfire! I am the leader!
                    setFrozenUntil(Date.now() + 1000 * 60 * 3); // 3 mins
                    alert("🥶 Tu t'es gelé toi-même pour 3 minutes ! (Tu es le 1er)");
                } else {
                    // Would send network event here
                    alert(`🥶 Attaque Cryo envoyée sur ${target.name} ! (Simulation: Il devrait être gelé 3min)`);
                }
                break;

            case 'hotpotato':
                // PATATE CHAUDE: Swap one unmarked cell with random song from Library? 
                // MVP: Just unmark a random cell (Evil enough) or Replace song.
                // Let's replace a random unmarked song with "Never Gonna Give You Up" (Rickroll) or similar.
                // Finding a random cell
                const replaceableCells = myPlayer.grid.filter(c => c.song && !c.marked);
                if (replaceableCells.length > 0) {
                    const cellToSwap = replaceableCells[Math.floor(Math.random() * replaceableCells.length)];
                    // Ideally fetch random song. For now, let's just mark it as "SWAPPED" or visually distinct.
                    alert(`💣 Patate Chaude ! Une case aurait du être échangée.`);
                }
                break;

            case 'vampire':
                // VAMPIRE: Steal 10 points
                // Visual simulation
                alert("🧛 Tu as volé 10 points (virtuels) à ton voisin !");
                break;

            case 'zombie':
                alert("🧟 Zombie ! Une case random est infectée (Simulation).");
                break;

            case 'bunker':
                setProtectedUntil(Date.now() + 1000 * 60 * 15); // 15 mins
                alert("🛡️ Bunker activé ! Immunité totale pendant 15 min.");
                break;

            case 'casino':
                if (Math.random() > 0.5) {
                    hapticSuccess();
                    alert("🎰 JACKPOT ! +50 Points !");
                    // Logic to add points would go here
                } else {
                    hapticError();
                    alert("🎰 Perdu... Score remis à 0 (Simulation, ouf !)");
                }
                break;

            case 'unicorn':
                // UNICORN: Auto-complete a row
                // Find row with most checked items
                const size = Math.sqrt(myPlayer.grid.length);
                let bestRow = -1;
                let maxMarked = -1;

                for (let r = 0; r < size; r++) {
                    let marked = 0;
                    for (let c = 0; c < size; c++) if (myPlayer.grid[r * size + c].marked) marked++;
                    if (marked < size && marked > maxMarked) { // Must not be already full
                        maxMarked = marked;
                        bestRow = r;
                    }
                }

                if (bestRow !== -1) {
                    // Mark all in this row
                    for (let c = 0; c < size; c++) {
                        const cell = myPlayer.grid[bestRow * size + c];
                        if (!cell.marked) handleCellClick(cell, -1);
                    }
                    sendNotification(`🦄 LICORNE ! ${myPlayer.name} a complété une ligne !`);
                } else {
                    // Fallback random
                    const emptyCells = myPlayer.grid.filter(c => c.song && !c.marked);
                    if (emptyCells.length > 0) {
                        const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
                        handleCellClick(randomCell, -1);
                    }
                }
                break;

            case 'kamikaze':
                // Mark 3 cells random
                const emptyCellsK = myPlayer.grid.filter(c => c.song && !c.marked);
                const toMark = [];
                for (let i = 0; i < 3 && emptyCellsK.length > 0; i++) {
                    const idx = Math.floor(Math.random() * emptyCellsK.length);
                    toMark.push(emptyCellsK[idx]);
                    emptyCellsK.splice(idx, 1);
                }
                toMark.forEach(c => handleCellClick(c, -1));

                // Freeze self
                setFrozenUntil(Date.now() + 1000 * 60 * 60); // 1h
                alert("🧨 KAMIKAZE ! 3 cases validées, mais tu es GELÉ pour 1h !");
                break;

            case 'incognito':
                alert("🕵️ Incognito activé ! Score masqué.");
                break;

            case 'eclipse':
                // Blinds opponents. Simulator locally: Blinds self for demo.
                setBlindedUntil(Date.now() + 1000 * 60 * 30); // 30m
                alert("🌓 Éclipse ! Les titres sont cachés.");
                break;

            default:
                console.log("Applied Joker:", joker.name);
        }

        // Cooldown 30 mins
        setJokerCooldown(Date.now() + 1000 * 60 * 30);
    };
    const [showBatteryWarning, setShowBatteryWarning] = useState(false);

    // Auto-hide Battery Warning after 5s
    useEffect(() => {
        if (showBatteryWarning) {
            const timer = setTimeout(() => setShowBatteryWarning(false), 5000);
            return () => clearTimeout(timer);
        }
    }, [showBatteryWarning]);

    // Fix stale closure in async callbacks
    const gameRef = useRef(game);
    useEffect(() => { gameRef.current = game; }, [game]);

    // Debug Popup State
    useEffect(() => {
    }, [detectedMatch]);

    // ... (skipping unchanged code) ...

    // --- VICTORY EFFECTS ---
    const previousBingoCountRef = useRef(0);

    useEffect(() => {
        if (!game || !currentUser) return;
        const myPlayer = game.players.find(p => p.id === currentUser.id);
        if (!myPlayer) return;

        const currentBingos = myPlayer.bingoCount || 0;
        const previousBingos = previousBingoCountRef.current;

        if (currentBingos > previousBingos) {
            // FIREWORKS!
            const duration = 3000;
            const end = Date.now() + duration;

            const frame = () => {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: ['#ff00ff', '#00ffff', '#ffff00']
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: ['#ff00ff', '#00ffff', '#ffff00']
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            };
            frame();
            hapticSuccess();
        }
        previousBingoCountRef.current = currentBingos;
    }, [game, currentUser.id]);

    // AUTO-DAUB LOGIC
    const toggleAutoDaub = async () => {
        if (isAutoListening) {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                if (mediaStreamRef.current.audioContext) {
                    try { mediaStreamRef.current.audioContext.close(); } catch (e) { }
                }
                mediaStreamRef.current = null;
            }
            setIsAutoListening(false);
            hapticFeedback();
            return;
        }

        try {
            hapticClick();

            // 1. Train Database (V2)
            if (!dbReadyRef.current) {
                setIsAnalyzing(true);
                const songsToAnalyze = myPlayer.grid.map(c => c.song).filter(s => s);
                await trainDatabase(songsToAnalyze); // Index full sequences
                dbReadyRef.current = true;
                setIsAnalyzing(false);
            }

            // 2. Request Mic (Disable processing for music clarity)
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            mediaStreamRef.current = stream;

            // FORCE 44.1kHz to align with Meyda/Database assumptions
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
            await audioContext.resume();

            const source = audioContext.createMediaStreamSource(stream);

            // PRE-AMP: 4x Boost
            const preAmp = audioContext.createGain();
            preAmp.gain.value = 4.0;
            source.connect(preAmp);

            // Use AudioWorklet (Code imported from service to avoid redundancy)
            const blob = new Blob([CAPTURE_PROCESSOR_CODE], { type: 'application/javascript' });
            const workletUrl = URL.createObjectURL(blob);
            try { await audioContext.audioWorklet.addModule(workletUrl); } catch (e) { }

            const workletNode = new AudioWorkletNode(audioContext, 'capture-processor');

            let lastCheck = 0;

            workletNode.port.onmessage = (e) => {
                if (e.data.type === 'log') {
                    return;
                }

                // DUTY CYCLE: Throttle to 1 check per second to save battery
                const now = Date.now();
                if (now - lastCheck < 1000) return;
                lastCheck = now;

                const rawBuffer = e.data;
                const mockBuffer = {
                    length: rawBuffer.length,
                    sampleRate: audioContext.sampleRate,
                    getChannelData: () => rawBuffer
                };

                const currentG = gameRef.current;
                const currentP = currentG.players.find(p => p.id === currentUser.id) || currentG.players[0];

                // OPTIMIZATION: Get IDs of already marked cells to skip searching for them
                const ignoredIds = currentP.grid
                    .filter(c => c.song && c.marked)
                    .map(c => c.song.id);

                // Use V2 Matcher with Smart Confidence and Ignore List
                findMatchV2(mockBuffer, ignoredIds).then(result => {
                    if (!result) return;

                    const { id: matchId, score } = result;

                    // GET FRESH STATE
                    const currentG = gameRef.current;
                    const currentP = currentG.players.find(p => p.id === currentUser.id) || currentG.players[0];

                    // DEBUG: Log what we are looking for


                    // USE LOOSE EQUALITY (==) to handle String vs Number IDs
                    const cell = currentP.grid.find(c => c.song && c.song.id == matchId);

                    if (cell) {
                        if (!cell.marked) {
                            // STABILITY FILTER (Anti-Jitter)
                            if (matchHistoryRef.current.id === cell.id) {
                                matchHistoryRef.current.count++;
                            } else {
                                matchHistoryRef.current = { id: cell.id, count: 1 };
                            }


                            if (matchHistoryRef.current.count >= 2) {
                                setDetectedMatch(prev => {
                                    if (prev && prev.cell.id === cell.id) return prev;
                                    hapticClick();
                                    return { cell, score };
                                });
                            }
                        }
                    }
                });
            };

            const gainNode = audioContext.createGain();
            // TRICK: Very low volume (not zero) to keep AudioContext processing in background on some devices
            gainNode.gain.value = 0.001;

            preAmp.connect(workletNode);
            workletNode.connect(gainNode);
            gainNode.connect(audioContext.destination);

            // WAKE LOCK: Keep screen awake if possible (simplest way to prevent full sleep)
            if ('wakeLock' in navigator) {
                try {
                    await navigator.wakeLock.request('screen');
                } catch (e) {
                }
            }

            // MEDIA SESSION HACK: Register dummy handlers to keep "media" active
            if ('mediaSession' in navigator) {
                navigator.mediaSession.playbackState = "playing";
                navigator.mediaSession.setActionHandler('play', () => { });
                navigator.mediaSession.setActionHandler('pause', () => { });
            }

            setIsAutoListening(true);
            setShowBatteryWarning(true);
            mediaStreamRef.current.audioContext = audioContext;

        } catch (e) {
            console.error("AutoDaub error:", e);
            alert("Erreur accès micro : " + e.message);
            setIsAutoListening(false);
            setIsAnalyzing(false);
        }
    };
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedCellId, setSelectedCellId] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);
    const [tab, setTab] = useState('grid');
    const [modalTab, setModalTab] = useState('search');
    const [favoriteSongs, setFavoriteSongs] = useState([]);
    const [isMoveMode, setIsMoveMode] = useState(false);
    const [moveSourceIndex, setMoveSourceIndex] = useState(null);
    const [draggedItemIndex, setDraggedItemIndex] = useState(null);
    const [showGridOnGameOver, setShowGridOnGameOver] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    const [shareImageBlob, setShareImageBlob] = useState(null);
    const [showImageShareModal, setShowImageShareModal] = useState(false);
    const shareRef = useRef(null);


    // AUDIO HANDLING
    const { playingUrl, playingId, toggleAudio: hookToggleAudio } = useAudioPlayer((songId, freshUrl) => {
        // Update LOCAL state for ANY player (myself or opponent) so the UI sees the new URL matches 'playingUrl'
        // This ensures the Play/Pause icon toggles correctly even if the URL changed.
        const updatedPlayers = game.players.map(p => {
            const hasSong = p.grid.some(c => c.song && c.song.id === songId);
            if (hasSong) {
                const newGrid = p.grid.map(c => {
                    if (c.song && c.song.id === songId) {
                        return { ...c, song: { ...c.song, preview: freshUrl } };
                    }
                    return c;
                });

                // If it's ME, also sync to DB (Optimistic + Backend)
                if (p.id === currentUser.id) {
                    updatePlayerGrid(game.id, currentUser.id, newGrid);
                }

                return { ...p, grid: newGrid };
            }
            return p;
        });

        // Force update game state locally so the re-render happens with new Preview URLs
        setGame(prev => ({ ...prev, players: updatedPlayers }));
    });

    // Wrapper to add haptic click
    // Wrapper to add haptic click
    const toggleAudio = (e, songOrUrl) => {
        if (e && e.stopPropagation) e.stopPropagation();
        hapticClick();
        hookToggleAudio(songOrUrl);
    };

    // Compatibility wrapper for callers sending just URL (like modal closing)
    const baseToggleAudio = (url) => toggleAudio(null, url);

    useEffect(() => {
        const fetchFreshState = async () => {
            const freshGame = await joinGame(initialGame.id, currentUser);
            if (freshGame) {
                setGame(freshGame);
                onGameUpdate(freshGame);
            }
        };
        fetchFreshState();
        const unsubscribe = subscribeToGame(initialGame.id, (updatedGameData) => {
            setGame(updatedGameData);
            onGameUpdate(updatedGameData);
        });
        return () => unsubscribe();
    }, [initialGame.id]);

    const myPlayer = game.players.find(p => p.id === currentUser.id) || game.players[0];
    const isHost = game.hostId === currentUser.id;

    // Helper for optimistic grid updates
    const optimisticallyUpdateGrid = (newGrid) => {
        const updatedPlayers = game.players.map(p =>
            p.id === currentUser.id ? { ...p, grid: newGrid } : p
        );
        setGame(prev => ({ ...prev, players: updatedPlayers }));
    };

    // AUTO-DAUB LOGIC




















    // Cleanup Effect
    useEffect(() => {
        return () => {
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
                if (mediaStreamRef.current.audioContext) {
                    mediaStreamRef.current.audioContext.close();
                }
            }
        };
    }, []);

    const prevPlayersRef = useRef(game.players);

    useEffect(() => {
        // Check for NEW bingos compared to previous render
        game.players.forEach(player => {
            const prevPlayer = prevPlayersRef.current.find(p => p.id === player.id);
            const prevBingoCount = prevPlayer ? prevPlayer.bingoCount : 0;

            if (player.bingoCount > prevBingoCount) {
                // It's a NEW bingo!
                if (player.id === currentUser.id) {
                    // My Bingo
                    setShowConfetti(true);
                    hapticSuccess();
                    setTimeout(() => setShowConfetti(false), 5000);
                    sendNotification("BINGO ! 🥳", "Bravo ! Tu as fait un BINGO !");
                } else {
                    // Opponent Bingo
                    hapticFeedback(); // Tactile alert
                    sendNotification("BINGO ADVERSE ! 😱", `${player.name} a crié BINGO !`);
                }
            }
        });

        // Update ref for next render
        prevPlayersRef.current = game.players;

    }, [game.players, currentUser.id]);

    const prevStatusRef = useRef(game.status);
    useEffect(() => {
        if (game.status === 'finished' && prevStatusRef.current !== 'finished') {
            const winners = [...game.players].sort((a, b) => b.score - a.score);
            const winnerName = winners[0].name;
            sendNotification("🏆 FIN DE PARTIE !", `Le vainqueur est ${winnerName} !`);
            hapticSuccess();
        }
        prevStatusRef.current = game.status;
    }, [game.status, game.players]);

    useEffect(() => {
        if (!selectedCellId) return;
        // Always fetch favorites when modal opens to ensure hearts are correct in search results
        if (!currentUser.isGuest) {
            getFavorites(currentUser.id).then(setFavoriteSongs);
        }

        if (modalTab !== 'search') return;
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                setSearching(true);
                const results = await searchSongs(searchTerm);
                setSearchResults(results);
                setSearching(false);
            } else if (searchTerm.length === 0) {
                const trending = await getTrendingSongs();
                setSearchResults(trending);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, modalTab, selectedCellId]);

    // Trending songs fetched by the modal effect when needed
    // useEffect(() => { getTrendingSongs().then(setSearchResults); }, []);



    // DESKTOP DRAG & DROP HANDLERS
    const handleDragStart = (e, index) => {
        if (game.status !== 'lobby' || (myPlayer && myPlayer.isGridLocked)) {
            e.preventDefault();
            return;
        }
        setDraggedItemIndex(index);
        e.dataTransfer.effectAllowed = "move";
        hapticFeedback();
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        if (draggedItemIndex === null || draggedItemIndex === targetIndex) return;

        performSwap(draggedItemIndex, targetIndex);
        setDraggedItemIndex(null);
    };

    // SHARED SWAP LOGIC
    const performSwap = (sourceIdx, targetIdx) => {
        const newGrid = [...myPlayer.grid];
        const sourceItem = newGrid[sourceIdx];
        const targetItem = newGrid[targetIdx];
        newGrid[sourceIdx] = targetItem;
        newGrid[targetIdx] = sourceItem;

        // Optimistic Update
        optimisticallyUpdateGrid(newGrid);

        updatePlayerGrid(game.id, currentUser.id, newGrid);
        hapticSuccess();
    };

    // MOBILE TAP-TO-SWAP LOGIC
    const handleCellClick = (cell, index) => {
        hapticClick();

        // Prevent editing if grid is locked (except for marking songs)
        if (isMyGridLocked && !cell.song) {
            hapticError();
            // Alert removed
            return;
        }

        // 1. MOVE MODE (Only when unlocked)
        if (!isMyGridLocked && isMoveMode) {
            if (moveSourceIndex === null) {
                // Select Source
                setMoveSourceIndex(index);
                hapticFeedback();
            } else {
                if (moveSourceIndex === index) {
                    // Deselect
                    setMoveSourceIndex(null);
                } else {
                    // Swap
                    performSwap(moveSourceIndex, index);
                    setMoveSourceIndex(null);
                }
            }
            return;
        }

        // 2. ADD SONG MODE (Only when unlocked)
        if (!isMyGridLocked && !isMoveMode) {
            setSelectedCellId(cell.id);
            setSearchTerm('');
            setModalTab('search');
            return;
        }

        // 3. PLAYING MODE (Toggle Mark - Only when locked)
        if (isMyGridLocked && cell.song) {
            if (!myPlayer) return;

            // Optimistic Update for Marking
            const newMarkedState = !cell.marked;

            // We update local state immediately so it feels snappy
            const newGrid = myPlayer.grid.map(c =>
                c.id === cell.id ? { ...c, marked: newMarkedState } : c
            );
            optimisticallyUpdateGrid(newGrid);

            togglePlayerCell(game.id, currentUser.id, cell.id, newMarkedState);
        }
    };

    const handleSongSelect = async (song) => {
        hapticFeedback();
        if (!selectedCellId || !myPlayer) return;

        // --- CHECK NO DUPLICATES MODE ---
        if (game.settings?.noDuplicates) {
            const isTaken = game.players.some(p =>
                p.grid.some(c => c.song && c.song.id === song.id)
            );

            if (isTaken) {
                hapticError();
                alert(t(lang, 'game.errorDuplicate'));
                return;
            }
        }
        // --------------------------------

        const newGrid = myPlayer.grid.map(c => c.id === selectedCellId ? { ...c, song: song } : c);

        // OPTIMISTIC UPDATE: Update local state immediately and close modal
        optimisticallyUpdateGrid(newGrid);

        setSelectedCellId(null);

        if (playingUrl) baseToggleAudio(playingUrl);

        // Send to DB in background
        await updatePlayerGrid(game.id, currentUser.id, newGrid, song);
    };

    const handleFavToggle = async (e, song) => {
        e.stopPropagation();

        if (currentUser.isGuest) {
            hapticError();
            alert(t(lang, 'game.guestFavWarning'));
            return;
        }

        hapticClick();

        // Optimistic Update
        let newFavs;
        const exists = favoriteSongs.find(f => f.id === song.id);
        if (exists) {
            newFavs = favoriteSongs.filter(f => f.id !== song.id);
        } else {
            newFavs = [...favoriteSongs, song];
        }
        setFavoriteSongs(newFavs); // Update UI immediately

        // Sync DB
        await toggleFavorite(currentUser.id, song);
    }

    const toggleMyGridLock = async () => {
        hapticClick();
        setIsMoveMode(false);
        setMoveSourceIndex(null);
        await togglePlayerGridLock(game.id, currentUser.id);
    };

    const handleFinishGame = async () => {
        if (confirm(t(lang, 'game.btnFinish') + " ?")) {
            hapticSuccess();
            await finishGame(game.id);
        }
    }

    const copyCode = () => {
        hapticClick();
        navigator.clipboard.writeText(game.id);
        // Alert removed
    }

    const handleNativeShare = async () => {
        hapticClick();
        const url = `${window.location.origin}?game=${game.id}`;
        const shareData = {
            title: 'ChronoBingo',
            text: t(lang, 'game.shareText') + game.id,
            url: url
        };
        if (typeof navigator !== 'undefined' && navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error(err);
            }
        } else {
            navigator.clipboard.writeText(url);
            alert(t(lang, 'game.copied'));
        }
    };

    const handleImageShare = async () => {
        hapticClick();
        setShowImageShareModal(true);
        // Wait for modal to render content then snap it
        setTimeout(async () => {
            if (shareRef.current) {
                try {
                    // Shared onClone handler to fix truncation
                    const fixTruncation = (clonedNode) => {
                        const names = clonedNode.querySelectorAll('.share-name');
                        names.forEach(n => {
                            n.style.maxWidth = 'none';
                            n.style.width = 'auto';
                            n.style.overflow = 'visible';
                            n.style.textOverflow = 'clip';
                            n.style.whiteSpace = 'nowrap';
                            n.classList.remove('truncate');
                            // Reduce font size slightly to compensate for system font width appearing wider than webfont
                            n.style.fontSize = '90%';
                        });
                    };

                    // Attempt 1: High quality
                    // Increased pixelRatio to 3 to compensate for smaller visual size on mobile modal
                    const blob = await toBlob(shareRef.current, {
                        pixelRatio: 3,
                        backgroundColor: '#0f172a',
                        filter: (node) => node.tagName !== 'LINK' && !(node.getAttribute && node.getAttribute('data-broken') === 'true'),
                        fontEmbedCSS: '',
                        imagePlaceholder: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzMzMyIgZD0iTTEyIDJDMTYuNDEgMiAyMCA1LjU5IDIwIDEwUzE2LjQxIDE4IDEyIDE4IDQgMTQuNDEgNCAx十章 7.59 2 12 2zmMCAyYy0zLjMxIDAtNiAyLjY5LTYgNnM4IDIuNjkgNiA2IDYtMi42OSA2LTZzLTIuNjktNi02LTZ6bTQuMSAxM2wxLjkgMS45QzE2Ljc2IDIwLjIyIDE0LjUgMjIgMTIgMjJzLTQuNzYtMS43OC02LTAuMWwxLjktMS45QzkuMzEgMTguMDggMTAuNiAxNy41IDEyIDE3LjVzMi42OS41OCA0LjEgMS40eiIvPjwvc3ZnPg==',
                        onClone: fixTruncation
                    });
                    setShareImageBlob(blob);
                } catch (e) {
                    console.log("High res screenshot failed, trying Standard quality...", e);
                    try {
                        // Attempt 2: Standard quality - No cacheBust, lower ratio, KEEP IMAGES
                        const blob = await toBlob(shareRef.current, {
                            pixelRatio: 1.5,
                            backgroundColor: '#0f172a',
                            // No cacheBust here to try standard cache
                            // No aggressive filter on IMG
                            filter: (node) => node.tagName !== 'LINK' && !(node.getAttribute && node.getAttribute('data-broken') === 'true'),
                            fontEmbedCSS: '',
                            onClone: fixTruncation
                        });
                        setShareImageBlob(blob);
                    } catch (e2) {
                        console.log("Standard screenshot failed, trying fallback...", e2);
                        try {
                            // Attempt 3: Nuclear option - No images at all, just structure to ensure it works
                            const blob = await toBlob(shareRef.current, {
                                pixelRatio: 1,
                                backgroundColor: '#0f172a',
                                filter: (node) => node.tagName !== 'LINK' && node.tagName !== 'IMG',
                                fontEmbedCSS: '',
                                onClone: (clonedNode) => {
                                    const names = clonedNode.querySelectorAll('.share-name');
                                    names.forEach(n => {
                                        n.style.maxWidth = 'none';
                                        n.style.overflow = 'visible';
                                        n.classList.remove('truncate');
                                        n.style.fontSize = '90%';
                                    });
                                }
                            });
                            setShareImageBlob(blob);
                        } catch (e3) {
                            console.error("All screenshot attempts failed", e3);
                            alert(t(lang, 'game.errorScreenshot'));
                            setShowImageShareModal(false);
                        }
                    }
                }

            }
        }, 800);
    };

    const shareGeneratedImage = async () => {
        if (!shareImageBlob) return;
        hapticClick();

        const file = new File([shareImageBlob], 'my-chronobingo-grid.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Mon ChronoBingo',
                    text: 'Regarde ma grille ChronoBingo ! 🔥'
                });
            } catch (e) {
                console.log("Share failed", e);
            }
        } else {
            // Fallback: User can long press image to save
            alert("Ton image est prête ! Appuie longuement dessus pour l'enregistrer ou la partager.");
        }
    };

    const shareLink = () => {
        hapticClick();
        setShowShareModal(true);
    }

    const switchTab = (newTab) => { hapticClick(); setTab(newTab); }

    if (!myPlayer) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-fuchsia-500"></div></div>;

    const displayedSongs = modalTab === 'search' ? searchResults : favoriteSongs;
    const opponents = game.players.filter(p => p.id !== currentUser.id);

    // Check if my grid is locked
    const isMyGridLocked = myPlayer.isGridLocked || false;

    // GAME OVER SCREEN
    if (game.status === 'finished' && !showGridOnGameOver) {
        const winners = [...game.players].sort((a, b) => b.score - a.score);
        return (
            <div className="min-h-screen flex flex-col items-center p-4 animate-pop">
                <header className="w-full flex justify-between items-center mb-8 z-10 relative">
                    <div className="flex-1"></div>
                    <button onClick={() => { hapticClick(); removeCurrentGameId(); onLeave(); }} className="w-12 h-12 flex items-center justify-center bg-white/10 rounded-full hover:bg-white/20 transition-colors backdrop-blur-md shadow-lg border border-white/20 text-xl font-bold">✕</button>
                </header>
                <div className="z-20 flex flex-col items-center w-full">
                    <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 neon-text mb-2">{t(lang, 'game.gameOver')}</h1>
                    <p className="text-xl text-white font-bold mb-8 uppercase tracking-widest">🏆 {t(lang, 'game.winner')} : {winners[0].name}</p>

                    <div className="w-full max-w-md space-y-4 mb-8">
                        {winners.map((p, i) => (
                            <div key={p.id} className={`flex items-center p-4 rounded-3xl ${i === 0 ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 border border-yellow-500' : 'glass-liquid'} animate-pop`} style={{ animationDelay: `${i * 0.2}s` }}>
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xl mr-4 ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-slate-300 text-black' : i === 2 ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{i + 1}</div>
                                <img src={p.avatar} className="w-14 h-14 rounded-full border-2 border-white/10 mr-4 object-cover" crossOrigin="anonymous" alt="avt" />
                                <div className="flex-1">
                                    <p className="text-xl font-bold text-white">{p.name}</p>
                                    <p className="text-xs text-slate-400 font-black uppercase">{p.bingoCount} BINGO</p>
                                </div>
                                <div className="text-3xl font-black text-white">{p.score}</div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowGridOnGameOver(true)}
                        className="px-8 py-4 bg-white/10 border border-white/20 rounded-2xl font-black text-white uppercase tracking-widest hover:bg-white/20 transition-all elastic-active"
                    >
                        {t(lang, 'game.viewGrid')}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md mx-auto pb-20 relative min-h-dvh flex flex-col">
            {/* Battery Warning Banner */}
            {showBatteryWarning && (
                <div className="fixed top-0 left-0 w-full z-[100] bg-gradient-to-r from-red-600 to-orange-600 text-white text-[10px] font-bold py-2 px-4 text-center shadow-xl animate-slide-down border-b border-white/20">
                    {t(lang, 'game.batteryBanner')}
                </div>
            )}

            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center animate-pop">
                    <div className="text-9xl animate-bounce filter drop-shadow-[0_0_30px_rgba(217,70,239,0.8)]">🎉</div>
                </div>
            )}

            {/* Header - Floating Capsule matching Lobby 'Bonjour' design */}
            <header className="flex justify-between items-center sticky top-4 z-40 mb-8 mx-2 md:mx-4 p-2 md:p-3 rounded-3xl glass-liquid transition-all">
                <div className="flex-1 flex justify-start gap-1 md:gap-2">
                    <button onClick={() => { hapticClick(); onLeave(); }} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-white bg-white/5 rounded-full elastic-active">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={async () => {
                        if (confirm(t(lang, 'profile.quitGameConfirm'))) {
                            hapticClick();
                            await removePlayer(game.id, currentUser.id);
                            removeCurrentGameId();
                            onLeave();
                        }
                    }}
                        className="w-10 h-10 flex items-center justify-center text-red-500 hover:text-red-400 bg-red-500/10 rounded-full elastic-active"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex flex-col items-center">
                    <div className="flex items-center gap-2 md:gap-3 bg-black/40 backdrop-blur-sm rounded-full pl-3 pr-2 md:pl-5 md:pr-2 py-1.5 border border-white/10 shadow-lg">
                        <h1 className="font-black text-lg md:text-xl tracking-[0.2em] font-mono cursor-pointer elastic-active text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" onClick={copyCode}>
                            {game.id}
                        </h1>
                        <button onClick={shareLink} className="w-8 h-8 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition-colors border border-white/5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                        </button>
                    </div>
                </div>

                {game.status === 'finished' && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
                        <button
                            onClick={() => setShowGridOnGameOver(false)}
                            className="px-6 py-2 bg-yellow-500 text-black font-black rounded-full shadow-lg animate-bounce border-4 border-slate-900 whitespace-nowrap"
                        >
                            🏆 {t(lang, 'game.viewPodium')}
                        </button>
                    </div>
                )}

                {/* HOST FINISH BUTTON & TOOLS */}
                <div className="flex-1 flex justify-end items-center gap-1 md:gap-3">


                    {isHost && game.status !== 'finished' && game.players.some(p => p.isGridLocked) && (
                        <button onClick={handleFinishGame} className="w-10 h-10 bg-red-500/20 border border-red-500 text-red-500 rounded-full flex items-center justify-center elastic-active">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                            </svg>
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-full border-2 border-fuchsia-500 overflow-hidden cursor-pointer elastic-active shadow-[0_0_10px_rgba(217,70,239,0.5)]" onClick={() => { hapticClick(); onNavigateToProfile(); }}>
                        <img src={currentUser.avatar} alt="Me" className="object-cover w-full h-full" />
                    </div>
                </div>
            </header>

            {/* Tabs */}
            < div className="flex px-4 mb-4 gap-3" >
                {[
                    { id: 'grid', label: 'game.tabGrid', color: 'fuchsia' },
                    { id: 'players', label: 'game.tabPlayers', color: 'cyan', count: game.players.length }
                ].map(tObj => (
                    <button
                        key={tObj.id}
                        onClick={() => switchTab(tObj.id)}
                        className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all elastic-active ${tab === tObj.id
                            ? `bg-gradient-to-r from-${tObj.color}-600 to-${tObj.color === 'cyan' ? 'blue' : 'purple'}-600 text-white shadow-lg ring-2 ring-${tObj.color}-400/50`
                            : 'bg-slate-800 text-slate-400'}`}
                    >
                        {t(lang, tObj.label)}
                        {tObj.count !== undefined && <span className="bg-black/30 px-1.5 py-0.5 rounded-md ml-1">{tObj.count}</span>}
                    </button>
                ))}
            </div >

            {/* PREPARATION MODE SWITCH (Only if grid not locked) */}
            {
                tab === 'grid' && !isMyGridLocked && (
                    <div className="px-4 mb-4">
                        <div className="glass-liquid p-1 rounded-xl flex">
                            {[
                                {
                                    mode: false,
                                    label: 'game.btnAdd',
                                    icon: <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />,
                                    activeClass: 'bg-white text-slate-900',
                                    inactiveClass: 'text-slate-400'
                                },
                                {
                                    mode: true,
                                    label: 'game.btnReorder',
                                    icon: <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.433l-.312-.312a7 7 0 00-11.712 3.138.75.75 0 001.449.39 5.5 5.5 0 019.201-2.466l.312.312h-2.433a.75.75 0 000 1.5h4.242a.75.75 0 00.53-.219z" clipRule="evenodd" />,
                                    activeClass: 'bg-cyan-400 text-slate-900',
                                    inactiveClass: 'text-slate-400'
                                }
                            ].map((btn, i) => (
                                <button
                                    key={i}
                                    onClick={() => { setIsMoveMode(btn.mode); if (!btn.mode) setMoveSourceIndex(null); hapticClick(); }}
                                    className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${isMoveMode === btn.mode ? btn.activeClass : btn.inactiveClass}`}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        {btn.icon}
                                    </svg>
                                    {t(lang, btn.label)}
                                </button>
                            ))}
                        </div>
                        {isMoveMode && <p className="text-center text-[10px] text-cyan-300 mt-2 animate-pulse font-bold">Tap a song, then tap another to swap!</p>}
                    </div>
                )
            }

            <div className="flex-1 px-4">
                {tab === 'grid' && (
                    <div className="animate-pop">
                        {/* GRID CONTAINER - Dynamic Grid Size */}
                        <div
                            className="grid gap-3 aspect-square mb-6 select-none relative"
                            style={{ gridTemplateColumns: `repeat(${Math.sqrt(myPlayer.grid.length) || 4}, 1fr)` }}
                        >
                            {/* FROZEN OVERLAY - ICE EFFECT */}
                            {isFrozen && (
                                <div className="absolute -inset-4 z-50 rounded-3xl overflow-hidden pointer-events-none animate-in zoom-in-95 duration-500">
                                    {/* Frost Texture */}
                                    <div className="absolute inset-0 bg-cyan-100/20 backdrop-blur-[2px] mix-blend-overlay"></div>
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cracked-glass.png')] opacity-50 mix-blend-overlay"></div>

                                    {/* Borders / Frames */}
                                    <div className="absolute inset-0 border-[8px] border-white/40 rounded-3xl shadow-[inset_0_0_20px_rgba(255,255,255,0.5)]"></div>

                                    {/* Central Message */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="bg-slate-900/90 px-6 py-4 rounded-2xl border-2 border-cyan-300 shadow-[0_0_30px_rgba(34,211,238,0.5)] animate-bounce transform rotate-2">
                                            <p className="text-5xl mb-2 text-center drop-shadow-lg">🥶</p>
                                            <p className="font-black text-cyan-200 text-2xl uppercase tracking-[0.2em] text-center drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
                                                GELÉ !
                                            </p>
                                        </div>
                                    </div>

                                    {/* Floating Snowflakes */}
                                    <div className="absolute top-4 left-4 text-2xl animate-spin-slow opacity-80">❄️</div>
                                    <div className="absolute bottom-10 right-8 text-3xl animate-bounce opacity-80" style={{ animationDuration: '2s' }}>❄️</div>
                                    <div className="absolute top-1/2 right-4 text-xl animate-pulse opacity-60">❄️</div>
                                    <div className="absolute bottom-4 left-1/2 text-2xl animate-spin-slow opacity-70" style={{ animationDirection: 'reverse' }}>❄️</div>
                                </div>
                            )}
                            {myPlayer.grid.map((cell, index) => (
                                <div
                                    key={cell.id}
                                    draggable={game.status === 'lobby'}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    // ... check line number alignment below
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onClick={() => handleCellClick(cell, index)}
                                    className={`
                            relative rounded-xl overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 aspect-square
                            ${(isMoveMode || game.status === 'lobby') ? 'touch-manipulation' : ''}
                            ${(isMoveMode && !isMyGridLocked) ? 'animate-wiggle' : ''}
                            ${(isMoveMode && moveSourceIndex === index) ? 'ring-4 ring-cyan-400 scale-105 z-10' : ''}
                            ${cell.marked
                                            ? 'shadow-[0_0_20px_rgba(217,70,239,0.6)] scale-[1.02] animate-splash'
                                            : 'bg-white/5 hover:bg-white/10'}
                        `}
                                    style={{ boxShadow: cell.marked ? '' : 'inset 0 0 0 1px rgba(255,255,255,0.1)' }}
                                >
                                    {cell.song ? (
                                        <>
                                            {/* Image with NO opacity, just cover */}
                                            <img src={cell.song.cover} alt="art" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500" crossOrigin="anonymous" />

                                            {/* Dark Overlay for text readability (Darker if marked for contrast) */}
                                            <div className={`absolute inset-0 bg-black/50 transition-all duration-300 ${cell.marked ? 'bg-fuchsia-600/60 mix-blend-multiply' : ''}`} />

                                            {cell.song.preview && !isMoveMode && (
                                                <div className="absolute top-1 right-1 z-30" onClick={(e) => toggleAudio(e, cell.song)}>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md border shadow-sm transition-all elastic-active ${playingUrl === cell.song.preview || playingId === cell.song.id ? 'bg-cyan-400 border-cyan-200 animate-pulse' : 'bg-black/60 border-white/20'}`}>
                                                        {playingUrl === cell.song.preview || playingId === cell.song.id ? <div className="w-2 h-2 bg-white rounded-sm" /> : <span className="text-[10px]">🎵</span>}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="relative z-10 w-full px-1 flex flex-col justify-end h-full pb-2">
                                                {!isBlinded ? (
                                                    <>
                                                        <p className={`text-[11px] font-black leading-tight line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${cell.marked ? 'text-white' : 'text-white'}`}>{cell.song.title}</p>
                                                        <p className="text-[9px] font-bold leading-tight line-clamp-1 text-slate-300 uppercase tracking-wide mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{cell.song.artist}</p>
                                                    </>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center animate-pulse">
                                                        <span className="text-2xl drop-shadow-lg">❓</span>
                                                        <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-1">???</span>
                                                    </div>
                                                )}
                                            </div>

                                            {cell.marked && (
                                                <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                                                    <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/40 shadow-lg">
                                                        <svg className="w-6 h-6 text-white drop-shadow-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        !isMyGridLocked && (
                                            <div className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity cursor-copy">
                                                <div className="w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center text-cyan-400">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                                </div>
                                                <span className="text-[8px] font-black uppercase text-cyan-400">{t(lang, 'game.btnAdd')}</span>
                                            </div>
                                        )
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Individual Grid Lock Button - Only show if not locked */}
                        {!isMyGridLocked && (
                            <div className="text-center space-y-4 animate-pop delay-100">
                                <button
                                    onClick={toggleMyGridLock}
                                    className="w-full py-4 rounded-2xl font-black text-xl shadow-lg elastic-active transition-all bg-white text-emerald-600 shadow-[0_0_30px_rgba(16,185,129,0.4)]"
                                >
                                    {t(lang, 'game.btnLock')}
                                </button>
                                <p className="text-xs text-slate-400 font-bold">
                                    {t(lang, 'game.lockHint')}
                                </p>
                            </div>
                        )}

                        {isMyGridLocked && (
                            <div className="text-center p-4 glass-liquid rounded-3xl border border-fuchsia-500/20 mb-2 animate-pop relative">
                                <p className="text-xs font-black text-fuchsia-400 uppercase tracking-widest mb-1">{t(lang, 'game.score')}</p>
                                <div className="relative flex justify-center items-center h-20">
                                    <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">{myPlayer.score}</p>



                                    {/* JOKER BUTTON (Left) */}
                                    {game.settings?.jokersEnabled !== false && (
                                        <div className="absolute left-2 top-1/2 -translate-y-1/2">
                                            <button
                                                onClick={() => {
                                                    if (Date.now() < jokerCooldown) {
                                                        hapticError();
                                                        alert("Joker en recharge !");
                                                        return;
                                                    }
                                                    hapticClick();
                                                    setShowJokerModal(true);
                                                }}
                                                className={`
                                                w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-lg border-2 transition-all active:scale-95
                                                ${Date.now() < jokerCooldown
                                                        ? 'bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed grayscale'
                                                        : 'bg-gradient-to-br from-indigo-500 to-purple-600 border-white/20 hover:scale-110 animate-pulse'}
                                            `}
                                            >
                                                🃏
                                            </button>
                                            {Date.now() < jokerCooldown ? (
                                                <span className="text-[10px] text-slate-500 font-bold block mt-1">
                                                    {Math.ceil((jokerCooldown - Date.now()) / 1000 / 60)}min
                                                </span>
                                            ) : (
                                                <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400 mt-1 block">
                                                    Joker
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Auto-Daub Button (Right) */}
                                    {game.status !== 'finished' && (
                                        <div className="absolute right-4 flex flex-col items-center gap-1 group">
                                            {/* Battery Warning Chip (Visible on Hover or Initial Activation) */}


                                            <button
                                                onClick={toggleAutoDaub}
                                                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all shadow-lg active:scale-95 ${isAutoListening ? 'bg-fuchsia-500 border-white text-white animate-pulse shadow-fuchsia-500/50' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-fuchsia-500/50 hover:text-white'}`}
                                                title="Auto-Cochage"
                                            >
                                                {isAnalyzing ? (
                                                    <span className="animate-spin text-base">⌛</span>
                                                ) : (
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${isAutoListening ? 'text-white' : 'text-current'}`}>
                                                        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
                                                        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
                                                    </svg>
                                                )}
                                            </button>
                                            <span className={`text-[9px] font-black uppercase tracking-wider ${isAutoListening ? 'text-fuchsia-400 animate-pulse' : 'text-slate-500'}`}>
                                                Auto
                                            </span>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}

                        {/* STATUS EFFECTS SEPARATE CONTAINER - Full Width Match */}
                        {(isFrozen || isBlinded || isProtected) && (
                            <div className="relative flex flex-col items-center w-full mb-8 animate-in slide-in-from-top-2">

                                {/* DYNAMIC INFO PANEL (Visible on click, Absolute Overlay) */}
                                {selectedEffectInfo && (
                                    <div
                                        className={`absolute -top-12 z-50 px-4 py-2 rounded-xl text-center shadow-xl border animate-in slide-in-from-bottom-2 fade-in zoom-in-95 cursor-pointer min-w-[200px] max-w-[90%] ${selectedEffectInfo.color}`}
                                        onClick={() => setSelectedEffectInfo(null)}
                                        style={{ pointerEvents: 'auto' }}
                                    >
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 border-b border-r border-inherit bg-inherit"></div>
                                        <p className="text-xs font-black uppercase mb-0.5">{selectedEffectInfo.title}</p>
                                        <p className="text-[10px] opacity-90 leading-tight">{selectedEffectInfo.desc}</p>
                                    </div>
                                )}

                                <div className="glass-liquid rounded-3xl p-3 flex gap-2 justify-center w-full border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.3)]">
                                    {[
                                        { active: isFrozen, title: 'jokers.frozen', desc: 'jokers.frozenDesc', color: 'bg-cyan-500 text-white border-cyan-400', icon: '🧊', time: frozenUntil },
                                        { active: isBlinded, title: 'jokers.blinded', desc: 'jokers.blindedDesc', color: 'bg-slate-800 text-white border-slate-600', icon: '🌓', time: blindedUntil },
                                        { active: isProtected, title: 'jokers.protected', desc: 'jokers.protectedDesc', color: 'bg-emerald-500 text-slate-900 border-emerald-400', icon: '🛡️', time: protectedUntil }
                                    ].filter(e => e.active).map((effect, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedEffectInfo({ title: t(lang, effect.title), desc: t(lang, effect.desc), color: effect.color })}
                                            className={`${effect.color.split(' ')[0]} ${effect.color.split(' ')[1]} text-[9px] font-black px-3 py-1.5 rounded-xl flex items-center gap-2 border ${effect.color.split(' ').pop()} shadow-lg whitespace-nowrap cursor-help active:scale-95 transition-transform ${effect.title === 'jokers.frozen' ? 'animate-pulse' : ''}`}
                                        >
                                            <span className="text-sm">{effect.icon}</span>
                                            <div className="flex flex-col leading-none">
                                                <span>{t(lang, effect.title)}</span>
                                                <span className="opacity-80 text-[8px]">{formatTime(effect.time - now)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* OPPONENTS */}
                        {opponents.length > 0 && (
                            <div className="mt-8 pt-6 border-t border-white/5 animate-pop delay-200">
                                <h3 className="text-lg font-black mb-4 text-slate-400 flex items-center gap-2 uppercase tracking-widest">
                                    {t(lang, 'game.opponents')}
                                </h3>
                                <div className="space-y-6">
                                    {opponents.map(p => (
                                        <div key={p.id} className={`glass-liquid p-4 rounded-3xl ${p.bingoCount > 0 ? 'border-yellow-400/50 shadow-[0_0_30px_rgba(234,179,8,0.2)]' : ''}`}>
                                            <div className="flex items-center gap-3 mb-4">
                                                <img src={p.avatar} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full border-2 border-slate-600 object-cover" alt="avt" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-white">{p.name}</p>
                                                    {p.bingoCount > 0 && <p className="text-[10px] text-yellow-400 font-black animate-bounce uppercase">🏆 {t(lang, 'game.bingo')}</p>}
                                                </div>
                                                <span className="text-xl font-mono text-fuchsia-400 font-black">{p.score}</span>
                                            </div>

                                            <div
                                                className="grid gap-2 w-full p-2 bg-black/40 backdrop-blur-sm rounded-xl border border-white/5"
                                                style={{ gridTemplateColumns: `repeat(${Math.sqrt(p.grid.length) || 4}, 1fr)` }}
                                            >
                                                {p.grid.map((c, i) => (
                                                    <div
                                                        key={`${p.id}-cell-${i}`}
                                                        className={`relative rounded-lg overflow-hidden ${c.marked ? 'bg-fuchsia-600' : 'bg-white/5'} aspect-square border border-white/5`}
                                                    >
                                                        {c.song ? (
                                                            <>
                                                                <img src={c.song.cover} className="absolute inset-0 w-full h-full object-cover" alt="" crossOrigin="anonymous" />
                                                                <div className="absolute inset-0 bg-black/50"></div>

                                                                {/* Play Button - Top Right (Exact match to main grid) */}
                                                                {c.song.preview && (
                                                                    <div className="absolute top-1 right-1 z-30" onClick={(e) => toggleAudio(e, c.song)}>
                                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md border shadow-sm transition-all elastic-active cursor-pointer ${playingUrl === c.song.preview || playingId === c.song.id ? 'bg-cyan-400 border-cyan-200 animate-pulse' : 'bg-black/60 border-white/20'}`}>
                                                                            {playingUrl === c.song.preview || playingId === c.song.id ? <div className="w-2 h-2 bg-white rounded-sm" /> : <span className="text-[10px]">🎵</span>}
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="absolute bottom-0 inset-x-0 p-1 flex flex-col justify-end h-full relative z-10 pointer-events-none">
                                                                    <p className="text-[10px] leading-tight text-white truncate font-black text-center drop-shadow-md">{c.song.title}</p>
                                                                    <p className="text-[8px] leading-tight text-slate-300 truncate text-center mt-0.5 drop-shadow-md">{c.song.artist}</p>
                                                                </div>
                                                            </>
                                                        ) : <div className="w-full h-full flex items-center justify-center text-[8px] opacity-20">🎵</div>}

                                                        {c.marked && (
                                                            <div className="absolute inset-0 flex items-center justify-center z-10 bg-fuchsia-500/60 mix-blend-multiply pointer-events-none">
                                                                <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {tab === 'players' && (
                    <div className="space-y-3 animate-pop">
                        {game.players.sort((a, b) => b.score - a.score).map((p, i) => (
                            <div key={p.id} className={`flex items-center p-4 rounded-2xl border ${p.id === currentUser.id ? 'bg-slate-800 border-cyan-500 shadow-lg' : 'glass-liquid border-transparent'}`}>
                                <div className={`font-black w-8 text-center mr-2 ${i === 0 ? 'text-yellow-400 text-xl' : 'text-slate-500'}`}>{i + 1}</div>
                                <div className="relative mr-4">
                                    <img src={p.avatar} className="w-12 h-12 rounded-full border-2 border-slate-700 object-cover" crossOrigin="anonymous" alt="avt" />
                                    {p.id === game.hostId && (
                                        <div className="absolute -bottom-1 -right-1 bg-fuchsia-600 text-white p-1 rounded-full border-2 border-slate-900 shadow-sm" title="Hôte">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                <path fillRule="evenodd" d="M9.293 2.293a1 1 0 011.414 0l7 7A1 1 0 0117 11h-1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-3a1 1 0 00-1-1H9a1 1 0 00-1 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-6H3a1 1 0 01-.707-1.707l7-7z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold text-base text-white">{p.name} {p.id === game.hostId && '👑'}</p>
                                    <p className="text-xs text-slate-400 font-bold uppercase">{p.bingoCount > 0 ? `🔥 ${p.bingoCount} BINGO!` : t(lang, 'game.playing')}</p>
                                </div>
                                <div className="flex items-center gap-2 pl-2">
                                    {p.id === currentUser.id && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleImageShare(); }}
                                            className="w-8 h-8 flex items-center justify-center bg-cyan-500/10 text-cyan-400 rounded-full border border-cyan-500/30 hover:bg-cyan-500 hover:text-white transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                                            </svg>
                                        </button>
                                    )}
                                    {isHost && (
                                        <div className="flex items-center gap-2">
                                            {p.id !== currentUser.id && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (confirm(t(lang, 'game.confirmExcludePlayer'))) {
                                                            hapticClick();
                                                            await removePlayer(game.id, p.id);
                                                        }
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center bg-red-500/20 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-colors"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                        <path d="M11 6a3 3 0 11-6 0 3 3 0 016 0zM14 17a6 6 0 00-12 0h12zM13 8a1 1 0 100 2h4a1 1 0 100-2h-4z" />
                                                    </svg>
                                                </button>
                                            )}
                                            {p.isGridLocked && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (confirm(t(lang, 'game.confirmUnlockPlayer'))) {
                                                            hapticClick();
                                                            await togglePlayerGridLock(game.id, p.id);
                                                        }
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center bg-emerald-500/20 text-emerald-500 rounded-full hover:bg-emerald-500 hover:text-white transition-colors"
                                                    title="Déverrouiller"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                                        <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" className="hidden" /> {/* Standard Lock */}
                                                        <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" /> {/* Open Lock */}
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="text-right">
                                        <p className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">{p.score}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="mt-6 pt-4 border-t border-white/5 flex flex-row gap-3 justify-center">
                            {/* Save Game Button */}
                            <button
                                onClick={async () => {
                                    if (currentUser.isGuest) return;
                                    hapticClick();
                                    await toggleSaveGame(game.id, !game.isSaved);
                                }}
                                disabled={currentUser.isGuest}
                                className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[10px] transition-all flex items-center justify-center gap-2 ${currentUser.isGuest
                                    ? 'text-slate-600 cursor-not-allowed grayscale'
                                    : game.isSaved
                                        ? 'bg-green-500/10 text-green-400'
                                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M10 2c-1.716 0-3.408.106-5.07.31C3.806 2.45 3 3.414 3 4.517V17.25a.75.75 0 001.075.676L10 15.082l5.925 2.844A.75.75 0 0017 17.25V4.517c0-1.103-.806-2.068-1.93-2.207A41.403 41.403 0 0010 2z" clipRule="evenodd" />
                                </svg>
                                {game.isSaved ? t(lang, 'game.btnGameSaved') : t(lang, 'game.saveGame')}
                            </button>

                            {/* Share Story Button */}
                            <button
                                onClick={handleImageShare}
                                className="px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-[10px] text-fuchsia-400 hover:text-white hover:bg-fuchsia-500/10 transition-all flex items-center justify-center gap-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                                </svg>
                                {t(lang, 'game.shareStory')}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* SEARCH MODAL */}
            {
                selectedCellId && (
                    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center sm:p-4 animate-in fade-in duration-200">
                        {/* Backdrop */}
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => {
                            setSelectedCellId(null);
                            if (playingUrl) baseToggleAudio(playingUrl);
                        }}></div>

                        {/* Modal Content */}
                        <div className="relative w-full max-w-lg h-[92vh] h-[92dvh] md:h-[80vh] bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden animate-slide-up pt-safe">

                            {/* Modal Header - Sticky & Safe Area */}
                            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-slate-900/80 backdrop-blur-xl sticky top-0 z-20">
                                <div className="flex-1 flex bg-black/40 p-1 rounded-xl border border-white/10">
                                    <button onClick={() => setModalTab('search')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${modalTab === 'search' ? 'bg-cyan-500 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                                        🔍 {t(lang, 'game.modalTabSearch')}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (currentUser.isGuest) { hapticError(); alert(t(lang, 'game.guestFavWarning')); return; }
                                            setModalTab('favorites');
                                        }}
                                        className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${currentUser.isGuest ? 'opacity-50 cursor-not-allowed' : ''} ${modalTab === 'favorites' ? 'bg-fuchsia-500/80 text-white shadow-lg backdrop-blur-md' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        {currentUser.isGuest ? '🔒' : '❤️'} {t(lang, 'game.modalTabFavs')}
                                    </button>
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedCellId(null);
                                        if (playingUrl) baseToggleAudio(playingUrl);
                                    }}
                                    className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors border border-white/5"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            </div>

                            {modalTab === 'search' && (
                                <div className="p-4 pb-0">
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                        </div>
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder={t(lang, 'game.searchTitle')}
                                            className="w-full bg-black/20 text-white pl-11 pr-4 py-4 rounded-2xl border border-white/10 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 outline-none transition-all text-lg placeholder-slate-500 font-medium backdrop-blur-sm"
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe scrollbar-hide overscroll-contain">
                                {displayedSongs.map((song, i) => (
                                    <div key={`${song.id}-${i}`} onClick={() => handleSongSelect(song)} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/10 animate-pop" style={{ animationDelay: `${i * 0.05}s` }}>

                                        <div className="relative w-16 h-16 shrink-0">
                                            <img src={song.cover} className="w-full h-full rounded-xl shadow-lg object-cover group-hover:scale-105 transition-transform duration-300" alt="cover" />

                                            {song.preview && (
                                                <div className="absolute -bottom-2 -right-2 z-20">
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (playingUrl === song.preview) {
                                                                toggleAudio(e, song.preview);
                                                            } else {
                                                                const freshUrl = await refreshSongUrl(song.id);
                                                                if (freshUrl) {
                                                                    song.preview = freshUrl; // Opt update
                                                                    toggleAudio(e, freshUrl);
                                                                } else {
                                                                    toggleAudio(e, song.preview);
                                                                }
                                                            }
                                                        }}
                                                        className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg backdrop-blur-md border transition-all ${playingUrl === song.preview ? 'bg-cyan-500 border-cyan-400 text-white animate-pulse' : 'bg-black/60 border-white/20 text-white hover:bg-cyan-500 hover:border-cyan-400'}`}
                                                    >
                                                        {playingUrl === song.preview ? (
                                                            <div className="w-2 h-2 bg-white rounded-[1px]"></div>
                                                        ) : (
                                                            <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white truncate text-lg group-hover:text-cyan-300 transition-colors">{song.title}</p>
                                            <p className="text-xs text-slate-400 truncate uppercase tracking-wide font-bold mt-0.5">{song.artist}</p>
                                        </div>

                                        <button
                                            onClick={(e) => handleFavToggle(e, song)}
                                            className={`p-3 rounded-full hover:bg-white/10 active:scale-90 transition-transform group/heart ${currentUser.isGuest ? 'opacity-30 grayscale cursor-not-allowed' : ''}`}
                                        >
                                            {favoriteSongs.find(f => f.id === song.id) ? (
                                                <svg className="w-6 h-6 text-fuchsia-500 filter drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                            ) : (
                                                <svg className="w-6 h-6 text-slate-600 group-hover/heart:text-fuchsia-400 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                            )}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }
            {/* SHARE MODAL */}
            {showShareModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setShowShareModal(false)}>
                    <div className="bg-slate-900 border border-white/10 p-6 rounded-3xl w-full max-w-sm flex flex-col items-center animate-pop" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowShareModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/10 rounded-full text-slate-400 hover:text-white hover:bg-white/20 transition-colors">✕</button>

                        <h3 className="text-2xl font-black text-white mb-8 uppercase tracking-wider text-center">{t(lang, 'game.shareTitle')}</h3>

                        <div className="bg-white p-4 rounded-xl mb-4 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                            <QRCodeSVG value={`${typeof window !== 'undefined' ? window.location.origin : ''}?game=${game.id}`} size={200} />
                        </div>

                        <p className="text-slate-400 font-bold mb-6 uppercase text-[10px] tracking-widest">{t(lang, 'game.shareScan')}</p>

                        <div className="w-full h-px bg-white/10 mb-6"></div>

                        <p className="text-slate-500 font-bold mb-1 uppercase text-[10px] tracking-widest">{t(lang, 'game.code')}</p>
                        <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-8 tracking-widest font-mono select-all hover:scale-105 transition-transform cursor-pointer" onClick={copyCode}>
                            {game.id}
                        </div>

                        <button
                            onClick={handleNativeShare}
                            className="w-full py-4 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white font-bold rounded-2xl uppercase tracking-widest hover:brightness-110 transition-all shadow-lg elastic-active flex items-center justify-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                            </svg>
                            {t(lang, 'game.shareInvite')}
                        </button>
                    </div>
                </div>
            )}
            {/* IMAGE SHARE MODAL */}
            {showImageShareModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="bg-slate-900 rounded-3xl w-full max-w-sm flex flex-col relative border border-white/10 shadow-2xl max-h-[92dvh]">
                        <div className="absolute top-2 right-2 z-30">
                            <button
                                onClick={() => { setShowImageShareModal(false); setShareImageBlob(null); }}
                                className="w-8 h-8 flex items-center justify-center bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-md"
                            >✕</button>
                        </div>

                        <div className="p-4 flex flex-col items-center overflow-y-auto scrollbar-hide overscroll-contain w-full">
                            <h3 className="text-white font-black uppercase tracking-widest mb-4 text-center text-sm md:text-base">Story Preview</h3>

                            {/* The Capture Area - Fixed width for consistent layout and fit */}
                            <div className="w-full flex justify-center mb-4">
                                <div ref={shareRef} className="aspect-[9/16] w-[300px] shrink-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 flex flex-col items-center justify-center relative rounded-2xl overflow-hidden border border-white/10 select-none shadow-2xl" style={{ margin: 0 }}>
                                    {/* Decor */}
                                    {
                                        /* Decor - Using CSS Gradients instead of filter blur for html2canvas support */
                                    }
                                    <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] opacity-40" style={{ background: 'radial-gradient(circle, rgba(217,70,239,1) 0%, rgba(217,70,239,0) 70%)' }}></div>
                                    <div className="absolute bottom-[-20%] left-[-20%] w-[80%] h-[80%] opacity-40" style={{ background: 'radial-gradient(circle, rgba(6,182,212,1) 0%, rgba(6,182,212,0) 70%)' }}></div>

                                    <div className="relative z-10 flex flex-col items-center w-full h-full justify-between pt-8 pb-4">
                                        <div className="text-center w-full">
                                            {/* Fix for html2canvas: Use solid color or text-shadow instead of bg-clip-text */}
                                            {/* pr-2 compensates for italic visual weight. pl-[0.3em] compensates for tracking */}
                                            <h1 className="text-3xl font-black text-fuchsia-400 italic drop-shadow-[0_2px_0_rgba(255,255,255,1)] pr-2">ChronoBingo</h1>
                                            <p className="text-white/60 text-[10px] font-bold uppercase tracking-[0.3em] pl-[0.3em] mt-1">Party Game</p>
                                        </div>

                                        {/* Grid - Tilted as requested */}
                                        <div
                                            className="grid gap-1.5 w-full aspect-square bg-black/80 p-2 rounded-xl border border-white/10 shadow-2xl scale-90 transform rotate-2 my-auto"
                                            style={{ gridTemplateColumns: `repeat(${game.settings?.gridSize || 4}, 1fr)` }}
                                        >
                                            {myPlayer.grid.map((c, i) => (
                                                <div key={i} className={`relative rounded overflow-hidden aspect-square ${c.marked ? 'bg-fuchsia-500' : 'bg-white/10'}`}>
                                                    {c.song ? (
                                                        <>
                                                            {/* HTML2Canvas dislikes mix-blend-mode and filters. We use simple opacity layers instead. */}
                                                            <img src={c.song.cover} className="absolute inset-0 w-full h-full object-cover" crossOrigin="anonymous" referrerPolicy="no-referrer" alt="" onError={(e) => { e.target.style.opacity = 0; e.target.setAttribute('data-broken', 'true'); }} />

                                                            {/* Unmarked: Darken it significantly */}
                                                            {!c.marked && <div className="absolute inset-0 bg-slate-900/60"></div>}

                                                            {/* Marked: Add a colorful tint (without mix-blend-mode) */}
                                                            {c.marked && <div className="absolute inset-0 bg-fuchsia-500/20"></div>}
                                                        </>
                                                    ) : <div className="w-full h-full flex items-center justify-center text-[8px] opacity-20">🎵</div>}

                                                    {c.marked && (
                                                        <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-green-500 rounded-full flex items-center justify-center border border-white shadow-sm z-10">
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2 h-2 text-white">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        <div className="w-full px-2 mt-2">
                                            {/* PODIUM LOGIC */}
                                            <div className="flex items-end justify-center gap-2 mb-1">
                                                {/* Rank 2 */}
                                                {game.players.sort((a, b) => b.score - a.score)[1] && (
                                                    <div className="flex flex-col items-center">
                                                        <div className="relative w-8 h-8 mb-1 rounded-full border border-slate-400">
                                                            <img src={game.players.sort((a, b) => b.score - a.score)[1].avatar} className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" referrerPolicy="no-referrer" alt="" onError={(e) => { e.target.style.opacity = 0; e.target.setAttribute('data-broken', 'true'); }} />
                                                        </div>
                                                        <div className="share-name bg-slate-800/80 px-1.5 py-0.5 rounded text-[6px] font-bold text-white mb-0.5 whitespace-nowrap">{game.players.sort((a, b) => b.score - a.score)[1].name}</div>
                                                        <div className="h-6 w-8 bg-slate-400/40 rounded-t-md border-t border-x border-slate-400/50 flex items-center justify-center">
                                                            <span className="text-[8px] font-black text-slate-200">{game.players.sort((a, b) => b.score - a.score)[1].score}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Rank 1 */}
                                                {game.players.sort((a, b) => b.score - a.score)[0] && (
                                                    <div className="flex flex-col items-center z-10">
                                                        <div className="relative w-10 h-10 mb-1 rounded-full border-2 border-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                                                            <img src={game.players.sort((a, b) => b.score - a.score)[0].avatar} className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" referrerPolicy="no-referrer" alt="" onError={(e) => { e.target.style.opacity = 0; e.target.setAttribute('data-broken', 'true'); }} />
                                                            <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 text-xs">👑</div>
                                                        </div>
                                                        <div className="share-name bg-slate-800/80 px-2 py-0.5 rounded text-[7px] font-bold text-yellow-400 mb-0.5 whitespace-nowrap">{game.players.sort((a, b) => b.score - a.score)[0].name}</div>
                                                        <div className="h-8 w-10 bg-yellow-400/40 rounded-t-md border-t border-x border-yellow-400/50 flex items-center justify-center flex-col">
                                                            <span className="text-[10px] font-black text-white">{game.players.sort((a, b) => b.score - a.score)[0].score}</span>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Rank 3 */}
                                                {game.players.sort((a, b) => b.score - a.score)[2] && (
                                                    <div className="flex flex-col items-center">
                                                        <div className="relative w-8 h-8 mb-1 rounded-full border border-orange-700">
                                                            <img src={game.players.sort((a, b) => b.score - a.score)[2].avatar} className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" referrerPolicy="no-referrer" alt="" onError={(e) => { e.target.style.opacity = 0; e.target.setAttribute('data-broken', 'true'); }} />
                                                        </div>
                                                        <div className="share-name bg-slate-800/80 px-1.5 py-0.5 rounded text-[6px] font-bold text-white mb-0.5 whitespace-nowrap">{game.players.sort((a, b) => b.score - a.score)[2].name}</div>
                                                        <div className="h-4 w-8 bg-orange-700/40 rounded-t-md border-t border-x border-orange-700/50 flex items-center justify-center">
                                                            <span className="text-[8px] font-black text-orange-200">{game.players.sort((a, b) => b.score - a.score)[2].score}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* IF USER NOT IN TOP 3 - SHOW AS 4TH STEP ON RIGHT */}
                                                {!game.players.sort((a, b) => b.score - a.score).slice(0, 3).some(p => p.id === currentUser.id) && (
                                                    <div className="flex flex-col items-center">
                                                        <div className="relative w-8 h-8 mb-1 rounded-full border border-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]">
                                                            <img src={currentUser.avatar} className="w-full h-full object-cover rounded-full" crossOrigin="anonymous" referrerPolicy="no-referrer" alt="" onError={(e) => { e.target.style.opacity = 0; e.target.setAttribute('data-broken', 'true'); }} />
                                                        </div>
                                                        <div className="share-name bg-slate-800/80 px-1.5 py-0.5 rounded text-[6px] font-bold text-white mb-0.5 whitespace-nowrap">{currentUser.name}</div>
                                                        <div className="h-4 w-8 bg-fuchsia-600/40 rounded-t-md border-t border-x border-fuchsia-600/50 flex items-center justify-center">
                                                            <span className="text-[8px] font-black text-fuchsia-200">{myPlayer.score}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>


                                        </div>

                                        {/* FOOTER - MORE ENTICING & LOWER */}
                                        <div className="mt-auto flex flex-col items-center">
                                            <span className="text-white font-bold text-[8px] tracking-[0.2em] uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">chronobingo.com</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {shareImageBlob ? (
                                <button
                                    onClick={shareGeneratedImage}
                                    className="w-full py-4 bg-fuchsia-600 text-white font-black rounded-xl shadow-lg hover:bg-fuchsia-500 transition-all flex items-center justify-center gap-2 shrink-0"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                                    </svg>
                                    {t(lang, 'game.shareStory')}
                                </button>
                            ) : (
                                <div className="text-white/50 text-sm animate-pulse my-2">Génération...</div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* MATCH DETECTED POPUP */}            {detectedMatch && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-800 border-2 border-indigo-500/50 p-6 rounded-2xl shadow-2xl w-full max-w-sm flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-1">
                            <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                                {t(lang, 'game.detectedTitle')}
                            </h3>
                            <p className="text-slate-400 text-sm">{t(lang, 'game.detectedQuestion')}</p>
                        </div>

                        {detectedMatch.cell.song.cover && (
                            <div className="relative w-32 h-32 rounded-xl overflow-hidden shadow-lg ring-2 ring-indigo-500/30">
                                <img
                                    src={detectedMatch.cell.song.cover}
                                    className="w-full h-full object-cover"
                                    alt="Cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                                <div className={`absolute bottom-2 right-2 px-2 py-0.5 rounded text-xs font-bold font-mono ${detectedMatch.score > 0.5 ? 'bg-green-500/90 text-white' : 'bg-yellow-500/90 text-black'
                                    }`}>
                                    {(detectedMatch.score * 100).toFixed(0)}%
                                </div>
                            </div>
                        )}

                        <div className="text-center">
                            <h4 className="font-bold text-white text-lg leading-tight mb-1">
                                {detectedMatch.cell.song.title}
                            </h4>
                            <p className="text-indigo-300 text-sm">
                                {detectedMatch.cell.song.artist}
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 w-full mt-2">
                            <button
                                onClick={() => {
                                    hapticFeedback();
                                    setDetectedMatch(null);
                                    // Maybe add to ignore list?
                                }}
                                className="w-full py-3 rounded-xl bg-slate-700/50 text-slate-300 font-bold hover:bg-slate-700 active:scale-95 transition-all"
                            >
                                {t(lang, 'game.btnNo')}
                            </button>
                            <button
                                onClick={() => {
                                    hapticSuccess();
                                    togglePlayerCell(game.id, currentUser.id, detectedMatch.cell.id, true);
                                    // Notification removed to reduce spam
                                    setDetectedMatch(null);
                                }}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-lg shadow-indigo-500/25 active:scale-95 transition-all"
                            >
                                {t(lang, 'game.btnYes')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TUTORIAL */}
            <Tutorial lang={lang} />

            {/* JOKER ROULETTE */}
            {showJokerModal && (
                <JokerRoulette
                    lang={lang}
                    onClose={() => setShowJokerModal(false)}
                    onApplyJoker={handleApplyJoker}
                />
            )}
        </div>
    );
};

export default ActiveGame;
