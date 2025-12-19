
import React, { useState, useEffect, useRef } from 'react';
import { getUserProfile, toggleFavorite, logoutUser, getGameHistory, deleteUserAccount, removePlayer, toggleSaveGame, ACHIEVEMENTS } from '../services/gameService';
import { requestNotificationPermission, hasNotificationPermission } from '../services/notifications';
import { searchSongs } from '../services/music';
import { t } from '../services/translations';
import { hapticClick } from '../services/haptics';
import { useAudioPlayer } from '../hooks/useAudioPlayer';



const Profile = ({
    user,
    lang,
    onBack,
    onLogout,
    onRequestLogin,
    onLanguageChange,
    onRejoinGame,
    themeMode = 'system',
    setThemeMode = () => { },
    ecoMode = false,
    setEcoMode = () => { }
}) => {

    const [activeTab, setActiveTab] = useState('history'); // Default to history for everyone
    const [favorites, setFavorites] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState(null);
    const [songStats, setSongStats] = useState({});
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [notifEnabled, setNotifEnabled] = useState(false);

    // AUDIO HANDLING
    const { playingUrl, toggleAudio: hookToggleAudio } = useAudioPlayer((songId, freshUrl) => {
        const updateList = (list) => list.map(s => s.id === songId ? { ...s, preview: freshUrl } : s);
        setFavorites(prev => updateList(prev));
        setSearchResults(prev => updateList(prev));
    });

    const toggleAudio = (songOrUrl) => {
        // If passed a URL string, try to find the song object locally to enable robust refreshing
        let target = songOrUrl;
        if (typeof songOrUrl === 'string') {
            target = favorites.find(f => f.preview === songOrUrl) || searchResults.find(s => s.preview === songOrUrl) || songOrUrl;
        }
        hookToggleAudio(target);
    };

    useEffect(() => {
        setNotifEnabled(hasNotificationPermission());
    }, []);

    useEffect(() => {
        if (activeTab !== 'favorites') return;
        const delayDebounceFn = setTimeout(async () => {
            if (searchTerm.length > 2) {
                setSearching(true);
                const results = await searchSongs(searchTerm);
                setSearchResults(results);
                setSearching(false);
            } else {
                setSearchResults([]);
            }
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, activeTab]);

    useEffect(() => {
        const loadData = async () => {
            // Load History (Hybrid: Local for guest, DB for user)
            const userHistory = await getGameHistory(user.id);
            if (Array.isArray(userHistory)) {
                setHistory(userHistory.filter(h => h.userId === user.id));
            } else {
                setHistory([]);
            }

            if (user.isGuest) return;

            // Load full profile only for real users
            const profile = await getUserProfile(user.id);
            if (profile) {
                setFavorites(profile.favorites || []);
                setAchievements(profile.achievements || []);
                setStats(profile.stats);
                setSongStats(profile.song_stats || {});
            }
        };
        loadData();
    }, [user.id, user.isGuest]);

    const handleToggleFav = async (song) => {
        let newFavs;
        const exists = favorites.find(f => f.id === song.id);
        if (exists) {
            newFavs = favorites.filter(f => f.id !== song.id);
        } else {
            newFavs = [...favorites, song];
        }
        setFavorites(newFavs);
        await toggleFavorite(user.id, song);
    };

    const ratio = stats && stats.games_played > 0
        ? ((stats.games_won / stats.games_played) * 100).toFixed(0)
        : 0;

    const computedSongStats = Object.entries(songStats).map(([id, data]) => {
        const successRate = data.selected > 0 ? (data.validated / data.selected) : 0;
        return { id, ...data, successRate };
    });
    const bestSongs = [...computedSongStats].filter(s => s.selected >= 2).sort((a, b) => b.successRate - a.successRate).slice(0, 3);
    const worstSongs = [...computedSongStats].filter(s => s.selected >= 2 && s.successRate < 0.5).sort((a, b) => a.successRate - b.successRate).slice(0, 3);

    const handleLogout = async () => {
        await logoutUser();
        onLogout();
    };

    const handleDeleteAccount = async () => {
        if (window.confirm(t(lang, 'profile.deleteConfirm'))) {
            try {
                await deleteUserAccount(user.id);
                onLogout();
            } catch (error) {
                console.error("Delete Account Error:", error);
                alert("Error deleting account: " + (error.message || "Unknown error"));
            }
        }
    };

    const formatDate = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <div className="w-full max-w-2xl mx-auto pb-4 min-h-screen flex flex-col animate-pop pt-[calc(1rem+env(safe-area-inset-top))] md:pt-8">

            <header className="relative z-40 mx-4 mb-4 p-3 rounded-3xl glass-liquid flex items-center gap-4 transition-all shadow-lg border border-white/10 bg-black/40 backdrop-blur-xl">
                <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 transition-colors elastic-active">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-xl font-black text-white tracking-wide">{t(lang, 'profile.title')}</h1>
            </header>

            <div className="px-4 flex-1">
                <div className="glass-liquid p-6 rounded-3xl mb-8 border border-fuchsia-500/30">
                    <div className="flex items-center gap-6 mb-6">
                        <div className="relative">
                            <img
                                src={user.avatar}
                                referrerPolicy="no-referrer"
                                width={96}
                                height={96}
                                className="rounded-full border-4 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.4)] object-cover bg-slate-800"
                                alt="Profile"
                            />
                            <div className="absolute bottom-0 right-0 text-2xl">{user.isGuest ? '👻' : '👑'}</div>
                        </div>
                        <div>
                            <h2 className="text-3xl font-black text-white tracking-tight">{user.name}</h2>
                            <p className="text-fuchsia-300 font-bold uppercase tracking-widest text-xs mt-1">
                                {user.isGuest ? t(lang, 'profile.guestRole') : t(lang, 'profile.vipRole')}
                            </p>
                        </div>
                    </div>

                    {user.isGuest ? (
                        <div
                            onClick={onRequestLogin}
                            className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-center cursor-pointer hover:bg-yellow-500/20 active:scale-95 transition-all"
                        >
                            <p className="text-yellow-200 font-bold text-sm">{t(lang, 'profile.connectForStats')}</p>
                        </div>
                    ) : (
                        stats && (
                            <div className="grid grid-cols-3 gap-2 mt-4">
                                {[
                                    { l: 'profile.statGames', v: stats.games_played, c: 'text-white' },
                                    { l: 'profile.statWins', v: stats.games_won, c: 'text-yellow-400' },
                                    { l: 'profile.statRatio', v: ratio + '%', c: 'text-cyan-400' }
                                ].map((item, i) => (
                                    <div key={i} className="bg-black/30 p-3 rounded-xl text-center">
                                        <p className="text-xs text-slate-400 uppercase font-bold">{t(lang, item.l)}</p>
                                        <p className={`text-xl font-black ${item.c}`}>{item.v}</p>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>

                {!user.isGuest && (bestSongs.length > 0 || worstSongs.length > 0) && (
                    <div className="mb-8 space-y-4">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">{t(lang, 'profile.topsFlops')}</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {[
                                { title: 'profile.tops', data: bestSongs, icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', color: 'emerald', text: 'emerald-400' },
                                { title: 'profile.flops', data: worstSongs, icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6', color: 'red', text: 'red-500' }
                            ].map((s, i) => (
                                <div key={i} className={`glass-liquid p-4 rounded-2xl bg-${s.color}-500/5 border-${s.color}-500/20`}>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`w-6 h-6 rounded-full bg-${s.color}-500/20 flex items-center justify-center text-${s.text}`}>
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d={s.icon} /></svg>
                                        </div>
                                        <p className={`text-${s.text} font-black text-sm`}>{t(lang, s.title)}</p>
                                    </div>
                                    {s.data.map(track => (
                                        <div key={track.id} className="text-xs mb-1">
                                            <span className="text-white font-bold block truncate">{track.title}</span>
                                            <span className={`text-${s.text} font-mono`}>{(track.successRate * 100).toFixed(0)}% {t(lang, 'profile.winRate')}</span>
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex p-1.5 bg-slate-900/60 backdrop-blur-md rounded-2xl mb-8 border border-white/10 gap-1 overflow-x-auto">
                    {[
                        { id: 'history', label: 'profile.tabHistory', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
                        { id: 'achievements', label: 'lobby.achievements', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z', hide: user.isGuest },
                        { id: 'favorites', label: 'profile.tabFavs', icon: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z', hide: user.isGuest },
                        { id: 'settings', label: 'profile.tabSettings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
                    ].filter(t => !t.hide).map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 min-w-[60px] py-3 rounded-xl transition-all elastic-active flex flex-col items-center justify-center gap-1 ${activeTab === tab.id ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon} /></svg>
                            <span className="text-[10px] font-black uppercase tracking-wider hidden sm:block">{t(lang, tab.label)}</span>
                        </button>
                    ))}
                </div>

                <div className="flex-1 animate-pop delay-100">
                    {activeTab === 'history' && (
                        <div className="space-y-4">
                            {history.length === 0 ? (
                                <div className="text-center py-12 glass-liquid rounded-3xl">
                                    <span className="text-5xl mb-4 block opacity-50">📀</span>
                                    <p className="text-slate-400 font-bold">{t(lang, 'profile.noHistory')}</p>
                                </div>
                            ) : (
                                history.map((game, i) => (
                                    <div
                                        key={`${game.id}-${i}`}
                                        onClick={() => onRejoinGame(game.id)}
                                        className="glass-liquid p-5 rounded-3xl flex justify-between items-center hover:bg-white/5 transition-colors group cursor-pointer"
                                    >
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <p className="font-black text-white text-xl tracking-wider">{game.id}</p>
                                                <span className="text-fuchsia-400 font-black text-sm bg-fuchsia-500/10 px-2 py-0.5 rounded-lg border border-fuchsia-500/20">{game.myScore} PTS</span>
                                            </div>
                                            <p className="text-xs text-slate-400 font-bold uppercase mt-1">Host: {game.hostName} • {formatDate(game.date)}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            {!user.isGuest && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        hapticClick();
                                                        const newState = !game.isSaved; // Toggle
                                                        await toggleSaveGame(game.id, newState, user.id);
                                                        setHistory(prev => prev.map(h =>
                                                            h.id === game.id ? { ...h, isSaved: newState } : h
                                                        ));
                                                    }}
                                                    className={`px-3 py-1.5 w-24 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all shadow-md active:scale-95 ${game.isSaved ? 'bg-green-500 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white'}`}
                                                >
                                                    {game.isSaved ? t(lang, 'profile.btnSaved') : t(lang, 'profile.btnSave')}
                                                </button>
                                            )}
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm(t(lang, 'profile.deleteGameConfirm') || "Supprimer cette partie ?")) {
                                                        await removePlayer(game.id, user.id);
                                                        // Optimistic Update
                                                        setHistory(prev => prev.filter(h => h.id !== game.id));
                                                    }
                                                }}
                                                className="px-3 py-1.5 w-24 bg-red-500/10 text-red-500 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-red-500 hover:text-white transition-colors shadow-md"
                                            >
                                                {t(lang, 'profile.btnDelete')}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'achievements' && (
                        <div className="space-y-4 animate-slide-up">
                            {user.isGuest ? (
                                <div className="p-8 text-center bg-black/20 rounded-3xl border border-white/5 mx-4">
                                    <p className="text-3xl mb-3">🔒</p>
                                    <p className="text-slate-400 font-medium">{t(lang, 'lobby.guestFavWarning')}</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-3 p-4">
                                    {ACHIEVEMENTS.map(ach => {
                                        const unlocked = achievements.find(a => a.id === ach.id);
                                        return (
                                            <div key={ach.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${unlocked ? 'bg-indigo-900/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10' : 'bg-black/20 border-white/5 opacity-60'}`}>
                                                <div className={`text-4xl ${unlocked ? 'scale-110 drop-shadow-md' : 'grayscale brightness-50'}`}>
                                                    {ach.icon}
                                                </div>
                                                <div>
                                                    <h3 className={`font-black text-lg ${unlocked ? 'text-white' : 'text-slate-500'}`}>
                                                        {t(lang, `lobby.badge_${ach.id}`) || ach.id}
                                                    </h3>
                                                    <p className="text-xs text-slate-400 leading-snug">
                                                        {t(lang, `lobby.badge_${ach.id}_desc`)}
                                                    </p>
                                                    {unlocked && (
                                                        <p className="text-[10px] text-indigo-300 font-bold mt-1 uppercase tracking-wider">
                                                            Débloqué
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'favorites' && !user.isGuest && (
                        <div className="space-y-3">
                            {/* Search Input */}
                            <div className="relative mb-4">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                                </div>
                                <input
                                    type="text"
                                    placeholder={t(lang, 'game.searchTitle')}
                                    className="w-full bg-black/20 text-white pl-11 pr-12 py-4 rounded-2xl border border-white/10 focus:border-fuchsia-500/50 focus:ring-2 focus:ring-fuchsia-500/20 outline-none transition-all text-lg placeholder-slate-500 font-medium backdrop-blur-sm"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                                {searchTerm.length > 0 && (
                                    <button
                                        onClick={() => {
                                            hapticClick();
                                            setSearchTerm('');
                                        }}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-500 hover:text-white transition-colors"
                                    >
                                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                )}
                            </div>

                            {(searchTerm.length > 2 ? searchResults : favorites).length === 0 ? (
                                <div className="text-center py-12 glass-liquid rounded-3xl">
                                    <span className="text-5xl mb-4 block opacity-50">{searchTerm.length > 2 ? '🔍' : '💔'}</span>
                                    <p className="text-slate-400 font-bold">{searchTerm.length > 2 ? 'Aucun résultat' : t(lang, 'profile.noFavs')}</p>
                                </div>
                            ) : (
                                (searchTerm.length > 2 ? searchResults : favorites).map((song, i) => {
                                    const isFav = favorites.find(f => f.id === song.id);
                                    return (
                                        <div key={song.id} className="group flex items-center gap-4 p-3 rounded-2xl hover:bg-white/5 cursor-default transition-all border border-transparent hover:border-white/10 animate-pop" style={{ animationDelay: `${i * 0.05}s` }}>

                                            <div className="relative w-16 h-16 shrink-0">
                                                <img
                                                    src={song.cover}
                                                    width={64}
                                                    height={64}
                                                    className="rounded-xl shadow-lg object-cover group-hover:scale-105 transition-transform duration-300 bg-slate-800"
                                                    alt="cover"
                                                />

                                                {song.preview && (
                                                    <div className="absolute -bottom-2 -right-2 z-20">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); toggleAudio(song.preview); }}
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
                                                onClick={(e) => { e.stopPropagation(); handleToggleFav(song); }}
                                                className="p-3 rounded-full hover:bg-white/10 active:scale-90 transition-transform group/heart"
                                            >
                                                {isFav ? (
                                                    <svg className="w-6 h-6 text-fuchsia-500 filter drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                                                ) : (
                                                    <svg className="w-6 h-6 text-slate-600 group-hover/heart:text-fuchsia-400 transition-colors" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                                                )}
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="space-y-6">
                            <div className="glass-liquid p-6 rounded-3xl space-y-6">
                                <div>
                                    <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">{t(lang, 'profile.lang')}</label>
                                    <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                                        {['fr', 'en'].map(l => (
                                            <button
                                                key={l}
                                                onClick={() => { hapticClick(); onLanguageChange(l); }}
                                                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all elastic-active ${lang === l ? 'bg-fuchsia-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
                                            >
                                                {l === 'fr' ? 'FRANÇAIS' : 'ENGLISH'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="w-full h-px bg-white/5 my-2" />

                                {/* THEME MODE SELECTOR */}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">{t(lang, 'lobby.theme')}</label>
                                    <div className="flex bg-black/40 p-1 rounded-2xl border border-white/10">
                                        {['system', 'light', 'dark'].map(mode => (
                                            <button
                                                key={mode}
                                                onClick={() => { hapticClick(); setThemeMode(mode); }}
                                                className={`flex-1 py-3 rounded-xl font-black text-sm transition-all elastic-active
                                                ${themeMode === mode ? 'bg-fuchsia-500 text-white shadow-lg' : 'text-slate-500 hover:text-white'}
                                            `}
                                            >
                                                {mode === 'system' && t(lang, 'lobby.themeDefault')}
                                                {mode === 'light' && 'Light'}
                                                {mode === 'dark' && t(lang, 'lobby.themeDark')}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="w-full h-px bg-white/5 my-2" />

                                {/* ECO MODE SWITCH */}
                                <div className="flex items-center justify-between p-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${ecoMode ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{t(lang, 'lobby.themeEco')}</p>
                                            <p className="text-[10px] text-slate-400">{t(lang, 'lobby.batterySaverDesc')}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { hapticClick(); setEcoMode(!ecoMode); }}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${ecoMode ? 'bg-green-500' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-transform ${ecoMode ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>

                                <div className="w-full h-px bg-white/5 my-2" />

                                {/* NOTIFICATIONS SWITCH */}
                                <div className="flex items-center justify-between p-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${notifEnabled ? 'bg-fuchsia-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{t(lang, 'profile.notifications')}</p>
                                            <p className="text-[10px] text-slate-400">{notifEnabled ? t(lang, 'profile.notifOn') : t(lang, 'profile.notifOff')}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            hapticClick();
                                            if (notifEnabled) {
                                                // User wants to disable
                                                setNotifEnabled(false);
                                            } else {
                                                // User wants to enable
                                                const granted = await requestNotificationPermission();
                                                setNotifEnabled(granted);
                                                if (!granted) {
                                                    alert("Veuillez autoriser les notifications dans les paramètres de votre navigateur.");
                                                }
                                            }
                                        }}
                                        className={`w-12 h-7 rounded-full transition-colors relative ${notifEnabled ? 'bg-fuchsia-500' : 'bg-slate-700'}`}
                                    >
                                        <div className={`w-5 h-5 bg-white rounded-full shadow-md absolute top-1 transition-transform ${notifEnabled ? 'left-6' : 'left-1'}`} />
                                    </button>
                                </div>


                                <div>
                                    <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">{t(lang, 'profile.credits')}</label>
                                    <div className="bg-black/20 rounded-2xl p-4 text-xs text-slate-400 space-y-2 font-medium">
                                        <p className="flex items-center gap-2">
                                            <span>🎵</span> {t(lang, 'profile.musicBy')} <a href="https://www.deezer.com" target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:underline">Deezer</a>
                                        </p>
                                        <p className="flex items-center gap-2">
                                            <span>👾</span> {t(lang, 'profile.avatarsBy')} <a href="https://dicebear.com" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">DiceBear</a> (CC BY 4.0)
                                        </p>
                                        <p className="flex items-center gap-2 pt-2 border-t border-white/5">
                                            <span>👨‍💻</span> {t(lang, 'profile.github')} <a href="https://github.com/TBillaudeau/chronobingo" target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:underline">GitHub</a>
                                        </p>

                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="w-full py-4 bg-red-500/10 border border-red-500/50 text-red-400 font-black rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg elastic-active"
                            >
                                {user.isGuest ? t(lang, 'profile.quitGuest') : t(lang, 'profile.btnLogout')}
                            </button>

                            {!user.isGuest && (
                                <button
                                    onClick={handleDeleteAccount}
                                    className="w-full py-4 bg-transparent border border-slate-700 text-slate-500 font-bold rounded-2xl hover:bg-red-900/20 hover:text-red-400 hover:border-red-900/50 transition-all text-sm"
                                >
                                    {t(lang, 'profile.deleteAccount')}
                                </button>
                            )}

                            <a
                                href="/privacy"
                                className="block w-full py-3 text-center text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
                            >
                                {lang === 'fr' ? 'Politique de Confidentialité & Mentions Légales' : 'Privacy Policy & Legal Notice'}
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Profile;
