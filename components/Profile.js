
import React, { useState, useEffect, useRef } from 'react';
import { getUserProfile, toggleFavorite, logoutUser } from '../services/gameService';
import { t } from '../services/translations';

const Profile = ({ user, lang, onBack, onLogout, onLanguageChange, onRejoinGame }) => {
  const [activeTab, setActiveTab] = useState('history');
  const [favorites, setFavorites] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [songStats, setSongStats] = useState({});
  const [playingUrl, setPlayingUrl] = useState(null);
  const audioRef = useRef(null);

  useEffect(() => {
    const loadProfile = async () => {
        const profile = await getUserProfile(user.id);
        if (profile) {
            setFavorites(profile.favorites || []);
            setHistory(profile.history ? profile.history.filter(h => h.userId === user.id) : []);
            setStats(profile.stats);
            setSongStats(profile.song_stats || {});
        }
    };
    loadProfile();
  }, [user.id]);

  const handleToggleFav = async (song) => {
      const newFavs = await toggleFavorite(user.id, song);
      if (newFavs) setFavorites(newFavs);
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

  // Compute Tops & Flops
  const computedSongStats = Object.entries(songStats).map(([id, data]) => {
      const successRate = data.selected > 0 ? (data.validated / data.selected) : 0;
      return { id, ...data, successRate };
  });
  
  // Best: High success rate, min 2 selections
  const bestSongs = [...computedSongStats]
      .filter(s => s.selected >= 2)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 3);

  // Worst: Low success rate, High selections
  const worstSongs = [...computedSongStats]
      .filter(s => s.selected >= 2 && s.successRate < 0.5)
      .sort((a, b) => a.successRate - b.successRate) // Lowest rate first
      .slice(0, 3);

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
                <img src={user.avatar} className="w-24 h-24 rounded-full border-4 border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.4)]" alt="Profile" />
                <div className="absolute bottom-0 right-0 text-2xl">👑</div>
            </div>
            <div>
                <h2 className="text-3xl font-black text-white tracking-tight">{user.name}</h2>
                <p className="text-fuchsia-300 font-bold uppercase tracking-widest text-xs mt-1">{user.email || 'VIP Guest'}</p>
            </div>
          </div>
          
          {stats && (
              <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-black/30 p-3 rounded-xl text-center">
                      <p className="text-xs text-slate-400 uppercase font-bold">Parties</p>
                      <p className="text-xl font-black text-white">{stats.games_played}</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl text-center">
                      <p className="text-xs text-slate-400 uppercase font-bold">Victoires</p>
                      <p className="text-xl font-black text-yellow-400">{stats.games_won}</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl text-center">
                      <p className="text-xs text-slate-400 uppercase font-bold">Ratio</p>
                      <p className="text-xl font-black text-cyan-400">{ratio}%</p>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl text-center col-span-3 mt-1">
                      <p className="text-xs text-slate-400 uppercase font-bold">Chansons Choisies</p>
                      <p className="text-xl font-black text-fuchsia-400">{stats.songs_chosen}</p>
                  </div>
              </div>
          )}
      </div>

      {/* TOPS & FLOPS */}
      {(bestSongs.length > 0 || worstSongs.length > 0) && (
          <div className="mb-8 space-y-4">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-2">Mes Tops & Flops</h3>
              <div className="grid grid-cols-2 gap-4">
                  <div className="glass-liquid p-4 rounded-2xl bg-emerald-500/5 border-emerald-500/20">
                      <p className="text-emerald-400 font-black text-sm mb-2">TOPS 🍀</p>
                      {bestSongs.length > 0 ? bestSongs.map(s => (
                          <div key={s.id} className="text-xs mb-1">
                              <span className="text-white font-bold block truncate">{s.title}</span>
                              <span className="text-emerald-500 font-mono">{(s.successRate * 100).toFixed(0)}% win</span>
                          </div>
                      )) : <p className="text-[10px] text-slate-500">Pas assez de données</p>}
                  </div>
                  <div className="glass-liquid p-4 rounded-2xl bg-red-500/5 border-red-500/20">
                      <p className="text-red-400 font-black text-sm mb-2">FLOPS 💀</p>
                      {worstSongs.length > 0 ? worstSongs.map(s => (
                          <div key={s.id} className="text-xs mb-1">
                              <span className="text-white font-bold block truncate">{s.title}</span>
                              <span className="text-red-500 font-mono">{(s.successRate * 100).toFixed(0)}% win</span>
                          </div>
                      )) : <p className="text-[10px] text-slate-500">Pas assez de données</p>}
                  </div>
              </div>
          </div>
      )}

      <div className="flex p-1.5 bg-slate-900/60 backdrop-blur-md rounded-2xl mb-8 border border-white/10">
          {['history', 'favorites', 'settings'].map(tab => (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all elastic-active ${activeTab === tab ? 'bg-fuchsia-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
              >
                  {t(lang, `profile.tab${tab === 'history' ? 'History' : tab === 'favorites' ? 'Favs' : 'Settings'}`)}
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
                        <div key={`${game.id}-${i}`} className="glass-liquid p-5 rounded-3xl flex justify-between items-center hover:bg-white/5 transition-colors group">
                            <div>
                                <p className="font-black text-white text-xl tracking-wider">{game.id}</p>
                                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Host: {game.hostName}</p>
                            </div>
                            <div className="text-right">
                                <span className="block text-fuchsia-400 font-black text-lg mb-1">{game.myScore} PTS</span>
                                <button 
                                    onClick={() => onRejoinGame(game.id)}
                                    className="px-5 py-2 bg-white text-slate-900 rounded-xl text-xs font-black hover:bg-cyan-400 hover:text-white transition-colors shadow-lg elastic-active"
                                >
                                    REJOIN
                                </button>
                            </div>
                        </div>
                     ))
                  )}
              </div>
          )}

          {activeTab === 'favorites' && (
              <div className="space-y-3">
                  {favorites.length === 0 ? (
                      <div className="text-center py-12 glass-liquid rounded-3xl">
                          <span className="text-5xl mb-4 block opacity-50">💔</span>
                          <p className="text-slate-400 font-bold">{t(lang, 'profile.noFavs')}</p>
                      </div>
                  ) : (
                      favorites.map(song => (
                          <div key={song.id} className="flex items-center gap-4 p-4 rounded-2xl glass-liquid border-transparent hover:border-fuchsia-500/30 transition-all">
                              {song.preview && (
                                  <button 
                                      onClick={() => toggleAudio(song.preview)}
                                      className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all shadow-lg ${playingUrl === song.preview ? 'bg-cyan-500 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:bg-white hover:text-slate-900'}`}
                                  >
                                      {playingUrl === song.preview ? 'II' : '▶'}
                                  </button>
                              )}
                              <img src={song.cover} className="w-14 h-14 rounded-xl shadow-md" alt="cover" />
                              <div className="flex-1 min-w-0">
                                  <p className="font-bold text-white truncate text-lg">{song.title}</p>
                                  <p className="text-xs text-slate-400 truncate font-bold uppercase tracking-wide">{song.artist}</p>
                              </div>
                              <button onClick={() => handleToggleFav(song)} className="text-fuchsia-500 p-2 elastic-active text-2xl">
                                  ♥
                              </button>
                          </div>
                      ))
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
                  </div>

                  <button 
                    onClick={() => { logoutUser(); onLogout(); }} 
                    className="w-full py-4 bg-red-500/10 border border-red-500/50 text-red-400 font-black rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-lg elastic-active"
                  >
                      {t(lang, 'profile.btnLogout')}
                  </button>
              </div>
          )}
      </div>
    </div>
  );
};

export default Profile;
