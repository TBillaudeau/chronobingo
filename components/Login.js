
import React, { useState } from 'react';
import { loginWithGoogle } from '../services/gameService';
import { t } from '../services/translations';
import { hapticClick } from '../services/haptics';

const Login = ({ lang, onLogin, initialCode }) => {
  const [mode, setMode] = useState('menu'); // 'menu' | 'guest_input'
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. Real Google Login
  const handleGoogleLogin = async () => {
      hapticClick();
      setIsLoading(true);
      try {
          await loginWithGoogle();
          // Redirect will happen, MainGame handles the rest
      } catch (error) {
          console.error("Login failed", error);
          setIsLoading(false);
          alert("Erreur de connexion Google");
      }
  };

  // 2. Guest Login Flow
  const handleGuestSubmit = async () => {
    if (!name.trim()) return;
    hapticClick();
    setIsLoading(true);
    
    const guestUser = {
        id: 'guest-' + Math.random().toString(36).substr(2, 9),
        name: name.trim(),
        avatar: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${name}guest`,
        isGuest: true
    };

    onLogin(guestUser); // Pass back to MainGame
  };
  
  const renderTitle = () => {
      return "DISCO BINGO".split('').map((char, index) => (
          <span key={index} className="inline-block animate-float" style={{ animationDelay: `${index * 0.1}s` }}>
            {char === ' ' ? '\u00A0' : char}
          </span>
      ));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[90vh] text-center px-4 relative overflow-hidden">
      
      <div className="mb-8 animate-pop">
          <h1 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 via-purple-400 to-cyan-400 neon-text tracking-tighter">
            {renderTitle()}
          </h1>
      </div>
      
      <p className="text-xl text-slate-300 mb-10 max-w-md font-light animate-pop delay-100">
        {t(lang, 'login.subtitle')}
      </p>

      <div className="glass-liquid p-8 rounded-3xl w-full max-w-md animate-pop delay-200">
        
        {mode === 'menu' ? (
            <div className="space-y-4">
                {/* Option A: Google (Persistent) */}
                <button 
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-4 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 elastic-active shadow-xl group"
                >
                  {isLoading ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900"></div>
                  ) : (
                      <>
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="G" />
                        <span className="text-lg">Connexion Google</span>
                      </>
                  )}
                </button>
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
                  className="w-full bg-slate-800/50 hover:bg-slate-800 text-slate-300 hover:text-white font-bold py-3 px-6 rounded-2xl transition-all elastic-active border border-white/10"
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
                  disabled={!name.trim() || isLoading}
                  className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(192,38,211,0.4)] text-lg elastic-active disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? '...' : "C'est parti !"}
                </button>
            </div>
        )}

      </div>
    </div>
  );
};

export default Login;
