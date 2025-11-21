
import React, { useState, useEffect } from 'react';
import { createGame, joinGame, getGameHistory, getGlobalLeaderboard } from '../services/gameService';
import { t } from '../services/translations';
import { hapticClick } from '../services/haptics';

const GameLobby = ({ user, lang, activeGame, onJoinGame, onNavigateToProfile }) => {
  const [joinId, setJoinId] = useState('');
  const [error, setError] = useState('');
  const [topSongs, setTopSongs] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [noDuplicates, setNoDuplicates] = useState(false);

  useEffect(() => {
      // Fetch Real Global Leaderboard
      getGlobalLeaderboard().then(setTopSongs);
      
      // Fetch Real User History from Profile DB
      getGameHistory(user.id).then(allHistory => {
          const userHistory = allHistory.filter(h => h.userId === user.id);
          const resumeHistory = userHistory.filter(h => h.status !== 'finished');
          setHistory(resumeHistory.slice(0, 3));
      });
  }, [user.id]);

  const handleCreate = async () => {
    hapticClick();
    setLoading(true);
    try {
        const settings = { noDuplicates };
        const game = await createGame(user, settings);
        onJoinGame(game);
    } catch (e) {
        console.error(e);
        setError("Erreur de création.");
    } finally {
        setLoading(false);
    }
  };

  const handleJoin = async (overrideId) => {
    hapticClick();
    const idToJoin = overrideId || joinId;
    const cleanId = idToJoin.trim().toUpperCase();
    
    if (cleanId.length < 3) {
        setError("Code trop court");
        return;
    }
    setLoading(true);
    setError('');
    try {
        const game = await joinGame(cleanId, user);
        if (game) onJoinGame(game);
        else setError(t(lang, 'lobby.errorNotFound'));
    } catch (e) {
        console.error(e);
        setError("Erreur de connexion");
    } finally {
        setLoading(false);
    }
  };

  const formatTimeAgo = (timestamp) => {
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / 60000);
      if (mins < 60) return `${mins} min`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} h`;
      return `${Math.floor(hours / 24)} j`;
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-8 animate-pop">
      
      {/* User Header */}
      <div className="flex items-center gap-4 mb-8 w-full glass-liquid p-4 rounded-3xl cursor-pointer group elastic-active hover:border-fuchsia-500/50 transition-all" onClick={() => { hapticClick(); onNavigateToProfile(); }}>
        <div className="relative">
            <img src={user.avatar} alt={user.name} className="w-14 h-14 rounded-full border-2 border-fuchsia-500 shadow-[0_0_15px_rgba(217,70,239,0.5)] group-hover:scale-110 transition-transform duration-300" />
            <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-slate-900"></div>
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-black text-white tracking-tight">{t(lang, 'lobby.hello')}, {user.name} !</h2>
          <p className="text-fuchsia-300 text-sm font-medium">{t(lang, 'lobby.ready')}</p>
        </div>
        <div className="bg-white/10 p-3 rounded-full group-hover:bg-white/20 transition-colors">
            <span className="text-xl block group-hover:rotate-90 transition-transform duration-500">⚙️</span>
        </div>
      </div>

      {/* Recent Games (Resume) */}
      {history.length > 0 && !activeGame && (
        <div className="w-full mb-8 animate-pop delay-100">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">{t(lang, 'lobby.recentGames')}</h3>
            <div className="grid gap-3">
                {history.map((game) => (
                    <button 
                        key={game.id}
                        onClick={() => handleJoin(game.id)}
                        disabled={loading}
                        className="w-full glass-liquid p-3 rounded-2xl flex items-center justify-between hover:bg-white/10 transition-colors elastic-active group text-left"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-lg">
                                🎮
                            </div>
                            <div>
                                <p className="font-black text-white tracking-wider font-mono text-lg group-hover:text-cyan-400 transition-colors">{game.id}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">
                                    {t(lang, 'lobby.host')}: <span className="text-slate-300">{game.hostName}</span> • {formatTimeAgo(game.date)}
                                </p>
                            </div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-cyan-500 group-hover:text-slate-900 transition-all">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                        </div>
                    </button>
                ))}
            </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Action: Create */}
        <div className="glass-liquid p-8 rounded-3xl flex flex-col items-center text-center hover:bg-white/5 transition-all h-full min-h-[320px] justify-between animate-float-fast" style={{ animationDelay: '0s' }}>
          <div className="flex flex-col items-center w-full">
              <div className="w-20 h-20 bg-gradient-to-br from-fuchsia-500 to-purple-600 rounded-2xl rotate-3 flex items-center justify-center mb-6 text-white shadow-lg shadow-fuchsia-900/50 group-hover:rotate-6 transition-transform duration-300">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
              </div>
              <h3 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-fuchsia-200">{t(lang, 'lobby.createTitle')}</h3>
              <p className="text-slate-400 mb-6 font-medium">{t(lang, 'lobby.createDesc')}</p>
              
              {/* Settings Toggle */}
              <div 
                 onClick={() => { setNoDuplicates(!noDuplicates); hapticClick(); }}
                 className={`w-full p-3 rounded-xl flex items-center gap-3 cursor-pointer transition-all elastic-active border ${noDuplicates ? 'bg-fuchsia-500/20 border-fuchsia-500' : 'bg-black/20 border-white/5 hover:bg-white/5'}`}
              >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${noDuplicates ? 'bg-fuchsia-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                      {noDuplicates && '✓'}
                  </div>
                  <div className="text-left">
                      <p className={`text-sm font-bold ${noDuplicates ? 'text-white' : 'text-slate-400'}`}>{t(lang, 'lobby.modeNoDuplicates')}</p>
                      <p className="text-[10px] text-slate-500">{t(lang, 'lobby.modeNoDuplicatesDesc')}</p>
                  </div>
              </div>

          </div>
          
          <button 
            onClick={handleCreate}
            disabled={loading}
            className="w-full py-4 rounded-2xl font-bold bg-white text-fuchsia-900 hover:bg-fuchsia-50 shadow-xl elastic-active transition-all mt-6 text-lg"
          >
            {loading ? '...' : t(lang, 'lobby.btnCreate')}
          </button>
        </div>

        {/* Action: Join */}
        <div className="glass-liquid p-8 rounded-3xl flex flex-col items-center text-center hover:bg-white/5 transition-all h-full min-h-[320px] justify-between animate-float-fast" style={{ animationDelay: '1.5s' }}>
          <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-blue-600 rounded-2xl -rotate-3 flex items-center justify-center mb-6 text-white shadow-lg shadow-cyan-900/50 group-hover:-rotate-6 transition-transform duration-300">
                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" /></svg>
              </div>
              <h3 className="text-3xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-200">{t(lang, 'lobby.joinTitle')}</h3>
              <p className="text-slate-400 mb-6 font-medium">{t(lang, 'lobby.joinDesc')}</p>
          </div>
          
          <div className="w-full mt-auto space-y-3">
            {error && <p className="text-red-400 text-sm font-bold animate-bounce">{error}</p>}
            <div className="w-full flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700">
              <input 
                type="text" 
                placeholder="ABCDEF"
                className="flex-1 min-w-0 bg-transparent text-white px-4 py-2 focus:outline-none uppercase font-mono tracking-[0.2em] text-center text-lg placeholder-slate-600 font-bold"
                value={joinId}
                onChange={(e) => {
                  setJoinId(e.target.value.toUpperCase().trim());
                  setError('');
                }}
              />
              <button 
                onClick={() => handleJoin()}
                disabled={loading || !joinId}
                className="shrink-0 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-900 font-bold px-6 rounded-xl transition-colors elastic-active shadow-lg"
              >
                {loading ? '...' : 'GO'}
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top Songs List (Global DB) */}
      <div className="mt-12 w-full animate-pop delay-200">
        <h3 className="text-lg font-black mb-4 text-slate-300 flex items-center gap-2 uppercase tracking-widest">
            <span className="text-yellow-400 text-xl">★</span> {t(lang, 'lobby.leaderboard')}
        </h3>
        <div className="glass-liquid rounded-3xl overflow-hidden p-2 space-y-2">
          {topSongs.length === 0 ? (
              <div className="text-center p-8 text-slate-500 text-sm font-bold">En attente de données...</div>
          ) : topSongs.map((song, i) => (
            <div key={song.id} className="flex items-center p-3 rounded-2xl hover:bg-white/10 transition-colors group cursor-default">
              <div className={`font-black text-xl w-10 h-10 flex items-center justify-center rounded-xl mr-3 shadow-inner ${i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-slate-300 text-slate-900' : i === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-800 text-slate-500'}`}>
                  {i + 1}
              </div>
              <img src={song.cover} className="w-12 h-12 rounded-xl shadow-md group-hover:scale-110 transition-transform duration-300" alt="Cover" />
              <div className="flex-1 min-w-0 ml-4">
                <p className="font-bold text-white truncate text-lg">{song.title}</p>
                <p className="text-xs text-slate-400 truncate font-medium uppercase tracking-wide">{song.artist}</p>
              </div>
              <div className="text-right ml-4 px-4 py-1 rounded-full bg-slate-900/50 border border-white/5">
                <span className="font-mono text-emerald-400 font-bold text-sm">{(song.validation_count || 0).toLocaleString()} Wins</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameLobby;
