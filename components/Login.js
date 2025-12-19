
import React, { useState } from 'react';
import { loginWithGoogle, loginWithSpotify } from '../services/gameService';
import { t } from '../services/translations';
import { hapticClick } from '../services/haptics';

const Login = ({ lang, onLogin, initialCode, onBack }) => {
  const [mode, setMode] = useState('menu'); // 'menu' | 'guest_input'
  const [name, setName] = useState('');
  const [loadingMethod, setLoadingMethod] = useState(null); // 'google', 'spotify', 'guest', null

  // 1. Generic OAuth Login
  const handleOAuth = async (provider) => {
    if (loadingMethod) return;
    hapticClick();
    setLoadingMethod(provider);
    try {
      if (provider === 'google') await loginWithGoogle();
      else if (provider === 'spotify') await loginWithSpotify();
    } catch (error) {
      console.error("Login failed", error);
      setLoadingMethod(null);
      alert(`Erreur de connexion ${provider === 'google' ? 'Google' : 'Spotify'}`);
    }
  };

  // 2. Guest Login Flow
  const handleGuestSubmit = async () => {
    if (!name.trim()) return;
    hapticClick();
    setLoadingMethod('guest');

    const guestUser = {
      id: 'guest-' + Math.random().toString(36).substr(2, 9),
      name: name.trim(),
      avatar: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${name}guest`,
      isGuest: true
    };

    onLogin(guestUser); // Pass back to MainGame
  };

  const renderTitle = () => {
    return "CHRONOBINGO".split('').map((char, index) => (
      <span key={index} className="inline-block animate-float" style={{ animationDelay: `${index * 0.1}s` }}>
        {char === ' ' ? '\u00A0' : char}
      </span>
    ));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] text-center px-4 py-8 relative overflow-hidden pt-[calc(3rem+env(safe-area-inset-top))] md:pt-12">

      {onBack && (
        <button
          onClick={() => { hapticClick(); onBack(); }}
          className="absolute left-6 z-50 p-2 text-white/50 hover:text-white transition-colors rounded-full hover:bg-white/10 top-[calc(1rem+env(safe-area-inset-top))] md:top-12"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
      )}

      <div className="mb-12 animate-pop relative z-10">
        {/* Glow effect simplified */}
        <div className="absolute inset-0 bg-fuchsia-500/20 blur-[50px] rounded-full mix-blend-screen"></div>

        {/* Text FIXED: Solid white with neon shadow (removed text-transparent which caused visibility issues) */}
        <h1 className="relative text-5xl md:text-7xl font-righteous text-white drop-shadow-[0_0_15px_rgba(217,70,239,0.8)] transform -rotate-2 pb-2">
          {renderTitle()}
        </h1>
        <div className="absolute -bottom-4 right-0 rotate-[-4deg]">
          <span className="bg-yellow-400 text-black text-xs md:text-sm font-black px-3 py-1 rounded-full shadow-xl border-2 border-white uppercase tracking-widest animate-bounce">
            Party Game
          </span>
        </div>
      </div>

      {/* Subtitle constrained width */}
      <p className="text-lg text-slate-300 mb-10 max-w-xs mx-auto font-light animate-pop delay-100 leading-tight">
        {t(lang, 'login.subtitle')}
      </p>

      <div className="glass-liquid p-8 rounded-3xl w-full max-w-md animate-pop delay-200">

        {mode === 'menu' ? (
          <div className="space-y-4">
            {/* Option A: Google (Persistent) */}
            {[
              {
                id: 'google',
                label: 'Connexion Google',
                bg: 'bg-white hover:bg-slate-100',
                text: 'text-slate-900',
                icon: <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="G" />,
                loader: 'border-slate-900'
              },
              {
                id: 'spotify',
                label: 'Connexion Spotify',
                bg: 'bg-[#1DB954] hover:bg-[#1ed760]',
                text: 'text-white',
                icon: <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.32-1.38 9.841-.719 13.44 1.5.42.3.6.84.3 1.32zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 14.82 1.14.54.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.24z" /></svg>,
                loader: 'border-white'
              }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => handleOAuth(p.id)}
                disabled={loadingMethod !== null}
                className={`w-full ${p.bg} ${p.text} font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 elastic-active shadow-xl group disabled:opacity-70 disabled:cursor-not-allowed`}
              >
                {loadingMethod === p.id ? (
                  <div className={`animate-spin rounded-full h-6 w-6 border-b-2 ${p.loader}`}></div>
                ) : (
                  <>
                    {p.icon}
                    <span className="text-lg">{p.label}</span>
                  </>
                )}
              </button>
            ))}

            <p className="text-[10px] text-slate-400 font-medium">
              Sauvegarde tes favoris, historique et statistiques.
            </p>

            <div className="relative flex py-2 items-center opacity-50 my-4">
              <div className="flex-grow border-t border-slate-500"></div>
              <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold">{t(lang, 'login.or')}</span>
              <div className="flex-grow border-t border-slate-500"></div>
            </div>

            {/* Option B: Guest (Ephemeral) */}
            <button
              onClick={() => { hapticClick(); setMode('guest_input'); }}
              disabled={loadingMethod !== null}
              className="w-full bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white font-bold py-3 px-6 rounded-2xl transition-all elastic-active border border-white/10 disabled:opacity-70"
            >
              {t(lang, 'login.btnGuest')}
            </button>
            <p className="text-[10px] text-slate-500">
              Compte éphémère. Tes données seront perdues à la déconnexion.
            </p>
          </div>
        ) : (
          <div className="space-y-6 animate-slide-up">
            <div className="text-left">
              <button onClick={() => setMode('menu')} className="text-xs text-slate-400 hover:text-white mb-4 flex items-center gap-1">
                ← Retour
              </button>
              <label className="text-xs font-bold text-fuchsia-300 uppercase ml-1 mb-1 block">{t(lang, 'login.placeholderNameInput')}</label>
              <input
                autoFocus
                type="text"
                placeholder="Ex: Disco Dave"
                className="w-full bg-slate-900/40 border border-slate-600 text-white rounded-2xl px-5 py-4 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition-all text-lg placeholder-slate-500"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGuestSubmit()}
              />
            </div>

            <button
              onClick={handleGuestSubmit}
              disabled={!name.trim() || loadingMethod !== null}
              className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(192,38,211,0.4)] text-lg elastic-active disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMethod === 'guest' ? '...' : "C'est parti !"}
            </button>
          </div>
        )}

      </div>

      <div className="mt-8 flex flex-col items-center animate-pop delay-300">

        <div className="text-slate-500 flex flex-col items-center gap-2 mt-8">
          <a href="/privacy" className="text-sm font-bold text-slate-400 hover:text-white transition-colors">
            {lang === 'fr' ? "Politique de Confidentialité" : "Privacy Policy"}
          </a>
          <p className="text-[10px] opacity-50 px-4 max-w-md font-medium">
            {lang === 'fr' ? "Tes données (ID, prénom, avatar) sont utilisées uniquement pour l'identification et le jeu." : "Your data (ID, first name, avatar) is used solely for authentication and gameplay."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
