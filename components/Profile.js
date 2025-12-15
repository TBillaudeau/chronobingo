
import React, { useState, useEffect, useRef } from 'react';
import { getUserProfile, toggleFavorite, logoutUser, getGameHistory, deleteUserAccount, removePlayer, toggleSaveGame } from '../services/gameService';
import { requestNotificationPermission, hasNotificationPermission } from '../services/notifications';
import { searchSongs } from '../services/music';
import { t } from '../services/translations';
import { hapticClick } from '../services/haptics';

const Profile = ({ user, lang, onBack, onLogout, onLanguageChange, onRejoinGame }) => {
    const [activeTab, setActiveTab] = useState('history'); // Default to history for everyone
    const [favorites, setFavorites] = useState([]);
    const [history, setHistory] = useState([]);
    const [stats, setStats] = useState(null);
    const [songStats, setSongStats] = useState({});
    const [playingUrl, setPlayingUrl] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [notifEnabled, setNotifEnabled] = useState(false);
    const audioRef = useRef(null);

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
            setHistory(userHistory.filter(h => h.userId === user.id));

            if (user.isGuest) return;

            // Load full profile only for real users
            const profile = await getUserProfile(user.id);
            if (profile) {
                setFavorites(profile.favorites || []);
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

    const toggleAudio = (url) => {
        if (!url) return;
        if (playingUrl === url) {
            if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
            setPlayingUrl(null);
        } else {
            if (audioRef.current) audioRef.current.pause();
            const audio = new Audio(url);
            audio.volume = 0.5;
            audio.onended = () => setPlayingUrl(null);
            audio.play();
            audioRef.current = audio;
            setPlayingUrl(url);
        }
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
        window.location.reload();
    };

    const handleDeleteAccount = async () => {
        if (window.confirm(t(lang, 'profile.deleteConfirm'))) {
            try {
                await deleteUserAccount(user.id);
                window.location.reload();
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
        <div className="w-full max-w-2xl mx-auto p-4 pt-8 pb-20 min-h-screen flex flex-col animate-pop">

            <div className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors backdrop-blur-md border border-white/10 elastic-active">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h1 className="text-3xl font-black neon-text tracking-wide">{t(lang, 'profile.title')}</h1>
            </div>

            <div className="glass-liquid p-6 rounded-3xl mb-8 border border-fuchsia-500/30">
                <div className="flex items-center gap-6 mb-6">
                    <div className="relative">
                        <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.4)] object-cover" alt="Profile" />
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
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-center">
                        <p className="text-yellow-200 font-bold text-sm">{t(lang, 'profile.connectForStats')}</p>
                    </div>
                ) : (
                    stats && (
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <div className="bg-black/30 p-3 rounded-xl text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold">{t(lang, 'profile.statGames')}</p>
                                <p className="text-xl font-black text-white">{stats.games_played}</p>
                            </div>
                            <div className="bg-black/30 p-3 rounded-xl text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold">{t(lang, 'profile.statWins')}</p>
                                <p className="text-xl font-black text-yellow-400">{stats.games_won}</p>
                            </div>
                            <div className="bg-black/30 p-3 rounded-xl text-center">
                                <p className="text-xs text-slate-400 uppercase font-bold">{t(lang, 'profile.statRatio')}</p>
                                <p className="text-xl font-black text-cyan-400">{ratio}%</p>
                            </div>
                        </div>
                    )
                )}
            </div>

            {!user.isGuest && (bestSongs.length > 0 || worstSongs.length > 0) && (
                <div className="mb-8 space-y-4">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">{t(lang, 'profile.topsFlops')}</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-liquid p-4 rounded-2xl bg-emerald-500/5 border-emerald-500/20">
                            <p className="text-emerald-400 font-black text-sm mb-2">{t(lang, 'profile.tops')}</p>
                            {bestSongs.map(s => (
                                <div key={s.id} className="text-xs mb-1">
                                    <span className="text-white font-bold block truncate">{s.title}</span>
                                    <span className="text-emerald-500 font-mono">{(s.successRate * 100).toFixed(0)}% {t(lang, 'profile.winRate')}</span>
                                </div>
                            ))}
                        </div>
                        <div className="glass-liquid p-4 rounded-2xl bg-red-500/5 border-red-500/20">
                            <p className="text-red-400 font-black text-sm mb-2">{t(lang, 'profile.flops')}</p>
                            {worstSongs.map(s => (
                                <div key={s.id} className="text-xs mb-1">
                                    <span className="text-white font-bold block truncate">{s.title}</span>
                                    <span className="text-red-500 font-mono">{(s.successRate * 100).toFixed(0)}% {t(lang, 'profile.winRate')}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex p-1.5 bg-slate-900/60 backdrop-blur-md rounded-2xl mb-8 border border-white/10">
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all elastic-active ${activeTab === 'history' ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    {t(lang, 'profile.tabHistory')}
                </button>

                {!user.isGuest && (
                    <button
                        onClick={() => setActiveTab('favorites')}
                        className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all elastic-active ${activeTab === 'favorites' ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        {t(lang, 'profile.tabFavs')}
                    </button>
                )}

                <button
                    onClick={() => setActiveTab('settings')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all elastic-active ${activeTab === 'settings' ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    {t(lang, 'profile.tabSettings')}
                </button>
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
                                        <p className="font-black text-white text-xl tracking-wider">{game.id}</p>
                                        <p className="text-xs text-slate-400 font-bold uppercase mt-1">Host: {game.hostName} • {formatDate(game.date)}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-3">
                                        <span className="block text-fuchsia-400 font-black text-lg">{game.myScore} PTS</span>
                                        {!user.isGuest && (
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    hapticClick();
                                                    await toggleSaveGame(game.id, true);
                                                    alert("Partie sauvegardée !");
                                                }}
                                                className="w-10 h-10 flex items-center justify-center bg-green-500/10 text-green-500 rounded-xl hover:bg-green-500 hover:text-white transition-all shadow-md active:scale-95"
                                                title="Sauvegarder la partie"
                                            >
                                                💾
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
                                            className="w-8 h-8 flex items-center justify-center bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            ))
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
                                className="w-full bg-black/20 text-white pl-11 pr-4 py-4 rounded-2xl border border-white/10 focus:border-fuchsia-500/50 focus:ring-2 focus:ring-fuchsia-500/20 outline-none transition-all text-lg placeholder-slate-500 font-medium backdrop-blur-sm"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
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
                                            <img src={song.cover} className="w-full h-full rounded-xl shadow-lg object-cover group-hover:scale-105 transition-transform duration-300" alt="cover" />

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
                                <div className="flex gap-3">
                                    {['fr', 'en'].map(l => (
                                        <button
                                            key={l}
                                            onClick={() => onLanguageChange(l)}
                                            className={`flex-1 py-4 rounded-2xl border-2 font-black text-lg transition-all elastic-active flex items-center justify-center gap-2 ${lang === l ? 'border-fuchsia-500 bg-fuchsia-500/20 text-white shadow-[0_0_15px_rgba(217,70,239,0.3)]' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                        >
                                            <span>{l === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                                            <span className="text-sm uppercase tracking-widest">{l === 'fr' ? 'Français' : 'English'}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">Notifications</label>
                                <button
                                    onClick={async () => {
                                        const granted = await requestNotificationPermission();
                                        setNotifEnabled(granted);
                                        if (granted) hapticClick();
                                    }}
                                    className={`w-full py-4 rounded-2xl border-2 font-bold text-sm transition-all elastic-active flex items-center justify-center gap-2 ${notifEnabled ? 'border-green-500 bg-green-500/20 text-white' : 'border-slate-700 text-slate-500 hover:border-slate-500'}`}
                                >
                                    <span>{notifEnabled ? '🔔 Notifications Actives' : '🔕 Activer les Notifications'}</span>
                                </button>
                            </div>


                            <div>
                                <label className="block text-xs font-black text-slate-400 mb-3 uppercase tracking-widest">Credits</label>
                                <div className="bg-black/20 rounded-2xl p-4 text-xs text-slate-400 space-y-2 font-medium">
                                    <p className="flex items-center gap-2">
                                        <span>🎵</span> Music data provided by <a href="https://www.deezer.com" target="_blank" rel="noopener noreferrer" className="text-white font-bold hover:underline">Deezer</a>
                                    </p>
                                    <p className="flex items-center gap-2">
                                        <span>👾</span> Avatars by <a href="https://dicebear.com" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">DiceBear</a> (CC BY 4.0)
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
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block w-full py-3 text-center text-xs text-slate-500 hover:text-slate-300 transition-colors underline"
                        >
                            {lang === 'fr' ? 'Politique de Confidentialité & Mentions Légales' : 'Privacy Policy & Legal Notice'}
                        </a>
                    </div>
                )}
            </div>
        </div >
    );
};

export default Profile;
