
import React, { useState, useEffect, useRef } from 'react';
import { updatePlayerGrid, updateGame, subscribeToGame, toggleFavorite, getFavorites, joinGame, removeCurrentGameId, toggleGlobalSong, finishGame, updateUserStats } from '../services/gameService';
import { searchSongs, getTrendingSongs } from '../services/music';
import { t } from '../services/translations';
import { hapticClick, hapticFeedback, hapticSuccess, hapticError } from '../services/haptics';

const ActiveGame = ({ initialGame, currentUser, lang, onGameUpdate, onLeave, onNavigateToProfile }) => {
    const [game, setGame] = useState(initialGame);
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
    const [playingUrl, setPlayingUrl] = useState(null);
    const [showGridOnGameOver, setShowGridOnGameOver] = useState(false);
    const audioRef = useRef(null);

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

    useEffect(() => {
        if (myPlayer && myPlayer.bingoCount > 0) {
            setShowConfetti(true);
            hapticSuccess();
            setTimeout(() => setShowConfetti(false), 5000);
        }
    }, [myPlayer?.bingoCount]);

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

    useEffect(() => { getTrendingSongs().then(setSearchResults); }, []);

    const toggleAudio = (e, url) => {
        e.stopPropagation();
        hapticClick();
        if (!url) return;
        if (playingUrl === url) {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            setPlayingUrl(null);
        } else {
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(url);
            audio.volume = 0.5;
            audio.onended = () => setPlayingUrl(null);
            audio.play().catch(err => console.error("Audio error", err));
            audioRef.current = audio;
            setPlayingUrl(url);
        }
    };

    // DESKTOP DRAG & DROP HANDLERS
    const handleDragStart = (e, index) => {
        if (game.status !== 'lobby') {
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
        const updatedPlayers = game.players.map(p =>
            p.id === currentUser.id ? { ...p, grid: newGrid } : p
        );
        setGame({ ...game, players: updatedPlayers });

        updatePlayerGrid(game.id, currentUser.id, newGrid);
        hapticSuccess();
    };

    // MOBILE TAP-TO-SWAP LOGIC
    const handleCellClick = (cell, index) => {
        hapticClick();

        // 1. MOVE MODE (Lobby Only - Mobile preferred)
        if (game.status === 'lobby' && isMoveMode) {
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

        // 2. ADD SONG MODE (Lobby Only OR Empty cell during Play for Late Joiners)
        if ((game.status === 'lobby' && !isMoveMode) || (game.status === 'playing' && !cell.song)) {
            setSelectedCellId(cell.id);
            setSearchTerm('');
            setModalTab('search');
            return;
        }

        // 3. PLAYING MODE (Toggle Mark)
        if (game.status === 'playing') {
            if (!myPlayer || !cell.song) return;

            // Optimistic Update for Marking
            const newMarkedState = !cell.marked;

            // We update local state immediately so it feels snappy
            const updatedPlayers = game.players.map(p => {
                if (p.grid.some(c => c.song?.id === cell.song.id)) {
                    // Update this song everywhere for everyone (since it's global toggle logic)
                    // Note: This is a partial optimistic guess, real sync happens via DB
                    const newGrid = p.grid.map(c =>
                        c.song?.id === cell.song.id ? { ...c, marked: newMarkedState } : c
                    );
                    return { ...p, grid: newGrid };
                }
                return p;
            });
            setGame({ ...game, players: updatedPlayers });

            toggleGlobalSong(game.id, cell.song.id, newMarkedState);
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
        const updatedPlayers = game.players.map(p =>
            p.id === currentUser.id ? { ...p, grid: newGrid } : p
        );
        setGame(prev => ({ ...prev, players: updatedPlayers }));
        setSelectedCellId(null);

        if (audioRef.current) audioRef.current.pause();
        setPlayingUrl(null);

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

    const startGame = () => {
        hapticSuccess();
        updateGame(game.id, { status: 'playing' });
    }

    const handleFinishGame = async () => {
        if (confirm("Terminer la partie ?")) {
            hapticSuccess();
            await finishGame(game.id);
        }
    }

    const copyCode = () => {
        hapticClick();
        navigator.clipboard.writeText(game.id);
        alert(t(lang, 'game.copied'));
    }

    const shareLink = () => {
        hapticClick();
        const url = `${window.location.origin}?game=${game.id}`;
        navigator.clipboard.writeText(url);
        alert("Lien copié : " + url);
    }

    const switchTab = (newTab) => { hapticClick(); setTab(newTab); }

    if (!myPlayer) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-fuchsia-500"></div></div>;

    const displayedSongs = modalTab === 'search' ? searchResults : favoriteSongs;
    const opponents = game.players.filter(p => p.id !== currentUser.id);

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
                                <img src={p.avatar} className="w-14 h-14 rounded-full border-2 border-white/10 mr-4 object-cover" alt="avt" />
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
                        Voir ma grille
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full max-w-md mx-auto pb-20 relative min-h-screen flex flex-col">
            {showConfetti && (
                <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center animate-pop">
                    <div className="text-9xl animate-bounce filter drop-shadow-[0_0_30px_rgba(217,70,239,0.8)]">🎉</div>
                </div>
            )}

            {/* Header - Cleaned up style (No glass-liquid borders) */}
            <header className="px-4 py-3 flex justify-between items-center sticky top-0 z-30 mb-4 backdrop-blur-md bg-slate-900/30 border-b border-white/5">
                <button onClick={() => { hapticClick(); removeCurrentGameId(); onLeave(); }} className="text-slate-400 hover:text-white p-2 elastic-active">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>

                <div className="flex flex-col items-center">
                    <div className={`text-[10px] font-black px-3 py-1 rounded-full mb-1 uppercase tracking-widest ${game.status === 'playing' ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-yellow-500 text-white shadow-[0_0_10px_rgba(234,179,8,0.5)]'}`}>
                        {game.status === 'playing' ? t(lang, 'game.statusPlaying') : t(lang, 'game.statusLobby')}
                    </div>
                    <div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-1 border border-white/10">
                        <h1 className="font-black text-lg tracking-widest cursor-pointer elastic-active" onClick={copyCode}>
                            <span className="text-cyan-400">{game.id}</span>
                        </h1>
                        <button onClick={shareLink} className="text-slate-400 hover:text-white elastic-active">🔗</button>
                    </div>
                </div>

                {game.status === 'finished' && (
                    <button
                        onClick={() => setShowGridOnGameOver(false)}
                        className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-yellow-500 text-black font-black rounded-full shadow-lg animate-bounce"
                    >
                        🏆 PODIUM
                    </button>
                )}

                {/* HOST FINISH BUTTON */}
                {isHost && game.status === 'playing' ? (
                    <button onClick={handleFinishGame} className="w-10 h-10 bg-red-500/20 border border-red-500 text-red-500 rounded-full flex items-center justify-center elastic-active shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                        🛑
                    </button>
                ) : (
                    <div className="w-10 h-10 rounded-full border-2 border-fuchsia-500 overflow-hidden cursor-pointer elastic-active shadow-[0_0_10px_rgba(217,70,239,0.5)]" onClick={() => { hapticClick(); onNavigateToProfile(); }}>
                        <img src={currentUser.avatar} alt="Me" className="object-cover w-full h-full" />
                    </div>
                )}
            </header>

            {/* Tabs */}
            <div className="flex px-4 mb-4 gap-3">
                <button onClick={() => switchTab('grid')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all elastic-active ${tab === 'grid' ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white shadow-lg ring-2 ring-fuchsia-400/50' : 'bg-slate-800 text-slate-400'}`}>{t(lang, 'game.tabGrid')}</button>
                <button onClick={() => switchTab('players')} className={`flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all elastic-active ${tab === 'players' ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg ring-2 ring-cyan-400/50' : 'bg-slate-800 text-slate-400'}`}>{t(lang, 'game.tabPlayers')} <span className="bg-black/30 px-1.5 py-0.5 rounded-md ml-1">{game.players.length}</span></button>
            </div>

            {/* PREPARATION MODE SWITCH (LOBBY) */}
            {tab === 'grid' && game.status === 'lobby' && (
                <div className="px-4 mb-4">
                    <div className="glass-liquid p-1 rounded-xl flex">
                        <button onClick={() => { setIsMoveMode(false); setMoveSourceIndex(null); hapticClick(); }} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${!isMoveMode ? 'bg-white text-slate-900' : 'text-slate-400'}`}>🎵 {t(lang, 'game.btnAdd')}</button>
                        <button onClick={() => { setIsMoveMode(true); hapticClick(); }} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${isMoveMode ? 'bg-cyan-400 text-slate-900' : 'text-slate-400'}`}>🔄 Reorder</button>
                    </div>
                    {isMoveMode && <p className="text-center text-[10px] text-cyan-300 mt-2 animate-pulse font-bold">Tap a song, then tap another to swap!</p>}
                </div>
            )}

            <div className="flex-1 px-4">
                {tab === 'grid' && (
                    <div className="animate-pop">
                        {/* GRID CONTAINER - Fixed Squares & Readability */}
                        <div className="grid grid-cols-4 gap-3 aspect-square mb-6 select-none">
                            {myPlayer.grid.map((cell, index) => (
                                <div
                                    key={cell.id}
                                    draggable={game.status === 'lobby'}
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, index)}
                                    onClick={() => handleCellClick(cell, index)}
                                    className={`
                            relative rounded-xl overflow-hidden flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 aspect-square
                            ${(isMoveMode || game.status === 'lobby') ? 'touch-manipulation' : ''}
                            ${(isMoveMode) ? 'animate-wiggle' : ''}
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
                                            <img src={cell.song.cover} alt="art" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500" />

                                            {/* Dark Overlay for text readability (Darker if marked for contrast) */}
                                            <div className={`absolute inset-0 bg-black/50 transition-all duration-300 ${cell.marked ? 'bg-fuchsia-600/60 mix-blend-multiply' : ''}`} />

                                            {cell.song.preview && !isMoveMode && (
                                                <div className="absolute top-1 right-1 z-30" onClick={(e) => toggleAudio(e, cell.song.preview)}>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center backdrop-blur-md border shadow-sm transition-all elastic-active ${playingUrl === cell.song.preview ? 'bg-cyan-400 border-cyan-200 animate-pulse' : 'bg-black/60 border-white/20'}`}>
                                                        {playingUrl === cell.song.preview ? <div className="w-2 h-2 bg-white rounded-sm" /> : <span className="text-[10px]">🎵</span>}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="relative z-10 w-full px-1 flex flex-col justify-end h-full pb-2">
                                                <p className={`text-[11px] font-black leading-tight line-clamp-2 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${cell.marked ? 'text-white' : 'text-white'}`}>{cell.song.title}</p>
                                                <p className="text-[9px] font-bold leading-tight line-clamp-1 text-slate-300 uppercase tracking-wide mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">{cell.song.artist}</p>
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
                                        <div className="flex flex-col items-center gap-1 opacity-50 hover:opacity-100 transition-opacity cursor-copy">
                                            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border-2 border-cyan-500 flex items-center justify-center text-cyan-400">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                                            </div>
                                            <span className="text-[8px] font-black uppercase text-cyan-400">Ajouter</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {game.status === 'lobby' ? (
                            <div className="text-center space-y-4 animate-pop delay-100">
                                {isHost ? (
                                    <button onClick={startGame} className="w-full py-4 bg-white text-emerald-600 rounded-2xl font-black text-xl shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse elastic-active">{t(lang, 'game.btnStart')}</button>
                                ) : (
                                    <div className="flex items-center justify-center gap-2 text-cyan-400 animate-pulse">
                                        <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                                        <p className="font-bold uppercase tracking-widest text-xs">{t(lang, 'game.waitingDj')}</p>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center p-4 glass-liquid rounded-3xl border border-fuchsia-500/20 mb-8 animate-pop">
                                <p className="text-xs font-black text-fuchsia-400 uppercase tracking-widest mb-1">{t(lang, 'game.score')}</p>
                                <p className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">{myPlayer.score}</p>
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
                                                <img src={p.avatar} className="w-10 h-10 rounded-full border-2 border-slate-600 object-cover" alt="avt" />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm font-bold text-white">{p.name}</p>
                                                    {p.bingoCount > 0 && <p className="text-[10px] text-yellow-400 font-black animate-bounce uppercase">🏆 {t(lang, 'game.bingo')}</p>}
                                                </div>
                                                <span className="text-xl font-mono text-fuchsia-400 font-black">{p.score}</span>
                                            </div>

                                            <div className="grid grid-cols-4 gap-2 w-full aspect-square bg-transparent p-0 rounded-2xl select-none">
                                                {p.grid.map((c, i) => (
                                                    <div
                                                        key={i}
                                                        onClick={(e) => c.song?.preview && toggleAudio(e, c.song.preview)}
                                                        className={`relative rounded-lg overflow-hidden ${c.marked ? 'bg-fuchsia-600' : 'bg-white/5'} aspect-square cursor-pointer elastic-active border border-white/5`}
                                                    >
                                                        {c.song ? (
                                                            <>
                                                                <img src={c.song.cover} className="absolute inset-0 w-full h-full object-cover" alt="" />
                                                                {/* Dark overlay for opponents too */}
                                                                <div className="absolute inset-0 bg-black/50"></div>

                                                                {playingUrl === c.song.preview && (
                                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
                                                                        <div className="w-3 h-3 bg-cyan-400 animate-ping rounded-full"></div>
                                                                    </div>
                                                                )}
                                                                <div className="absolute bottom-0 inset-x-0 p-1 flex flex-col justify-end h-full relative z-10">
                                                                    <p className="text-[10px] leading-tight text-white truncate font-black text-center drop-shadow-md">{c.song.title}</p>
                                                                    <p className="text-[8px] leading-tight text-slate-300 truncate text-center mt-0.5 drop-shadow-md">{c.song.artist}</p>
                                                                </div>
                                                            </>
                                                        ) : <div className="w-full h-full flex items-center justify-center text-[8px] opacity-20">🎵</div>}

                                                        {c.marked && (
                                                            <div className="absolute inset-0 flex items-center justify-center z-10 bg-fuchsia-500/60 mix-blend-multiply">
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
                                <img src={p.avatar} className="w-12 h-12 rounded-full mr-4 border-2 border-slate-700 object-cover" alt="avt" />
                                <div className="flex-1">
                                    <p className="font-bold text-base text-white">{p.name} {p.id === game.hostId && '👑'}</p>
                                    <p className="text-xs text-slate-400 font-bold uppercase">{p.bingoCount > 0 ? `🔥 ${p.bingoCount} BINGO!` : t(lang, 'game.playing')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-2xl text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-400">{p.score}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* SEARCH MODAL */}
            {selectedCellId && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center sm:p-4 animate-in fade-in duration-200">
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => { setSelectedCellId(null); if (audioRef.current) audioRef.current.pause(); setPlayingUrl(null); }}></div>

                    {/* Modal Content */}
                    <div className="relative w-full max-w-lg h-[99vh] md:h-[80vh] bg-slate-900/60 backdrop-blur-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-t-3xl md:rounded-3xl flex flex-col overflow-hidden animate-slide-up">

                        {/* Modal Header */}
                        <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/5">
                            <div className="flex-1 flex bg-black/20 p-1 rounded-xl border border-white/5">
                                <button onClick={() => setModalTab('search')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${modalTab === 'search' ? 'bg-cyan-500/80 text-white shadow-lg backdrop-blur-md' : 'text-slate-400 hover:text-white'}`}>
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
                                onClick={() => { setSelectedCellId(null); if (audioRef.current) audioRef.current.pause(); setPlayingUrl(null); }}
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

                        <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-safe scrollbar-hide">
                            {displayedSongs.map((song, i) => (
                                <div key={song.id} onClick={() => handleSongSelect(song)} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/10 animate-pop" style={{ animationDelay: `${i * 0.05}s` }}>

                                    <div className="relative w-16 h-16 shrink-0">
                                        <img src={song.cover} className="w-full h-full rounded-xl shadow-lg object-cover group-hover:scale-105 transition-transform duration-300" alt="cover" />

                                        {song.preview && (
                                            <div className="absolute -bottom-2 -right-2 z-20">
                                                <button
                                                    onClick={(e) => toggleAudio(e, song.preview)}
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
            )}
        </div>
    );
};

export default ActiveGame;
