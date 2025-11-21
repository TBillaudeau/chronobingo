
import React, { useState } from 'react';
import { saveUserToDb } from '../services/gameService';
import { t } from '../services/translations';
import { hapticClick } from '../services/haptics';

const Login = ({ lang, onLogin, initialCode }) => {
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const generateUser = (isGuest) => ({
    id: 'user-' + Math.random().toString(36).substr(2, 9),
    name: name.trim() || (isGuest ? 'Invité Mystère' : 'Party Animal'),
    email: isGuest ? undefined : 'user@example.com',
    avatar: `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${name || 'party'}${isGuest ? 'guest' : ''}`,
    isGuest
  });

  const handleLoginAction = async (isGuest) => {
    hapticClick();
    setIsLoading(true);
    const user = generateUser(isGuest);
    
    // Sync to DB immediately
    await saveUserToDb(user);
    
    onLogin(user, initialCode || '');
    setIsLoading(false);
  };
  
  // Letter animation helper
  const renderTitle = () => {
      const title = "DISCO BINGO";
      return title.split('').map((char, index) => (
          <span 
            key={index} 
            className="inline-block animate-float" 
            style={{ animationDelay: `${index * 0.1}s` }}
          >
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
        
        <div className="space-y-6 mb-8">
          <div className="text-left group">
            <label className="text-xs font-bold text-fuchsia-300 uppercase ml-1 mb-1 block group-focus-within:text-fuchsia-400 transition-colors">{t(lang, 'login.placeholderName')}</label>
            <input 
              type="text" 
              placeholder={t(lang, 'login.placeholderNameInput')}
              className="w-full bg-slate-900/40 border border-slate-600 text-white rounded-2xl px-5 py-4 focus:outline-none focus:border-fuchsia-500 focus:ring-2 focus:ring-fuchsia-500/20 transition-all text-lg placeholder-slate-500 hover:border-slate-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        
        <button 
          onClick={() => handleLoginAction(true)}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-[0_0_20px_rgba(192,38,211,0.4)] mb-4 text-lg elastic-active relative overflow-hidden group"
        >
          <span className="relative z-10">{isLoading ? '...' : t(lang, 'login.btnGuest')}</span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-2xl"></div>
        </button>

        <div className="relative flex py-3 items-center mb-4 opacity-50">
          <div className="flex-grow border-t border-slate-500"></div>
          <span className="flex-shrink-0 mx-4 text-slate-400 text-xs font-bold">{t(lang, 'login.or')}</span>
          <div className="flex-grow border-t border-slate-500"></div>
        </div>

        <button 
          onClick={() => handleLoginAction(false)}
          disabled={isLoading}
          className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3 px-6 rounded-2xl transition-all flex items-center justify-center gap-3 elastic-active shadow-lg"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="G" />
          {t(lang, 'login.btnGoogle')}
        </button>
      </div>
    </div>
  );
};

export default Login;
