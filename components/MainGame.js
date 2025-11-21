
import React, { useState, useEffect } from 'react';
import { getLocalUser, joinGame, getCurrentGameId, saveLocalUser, saveUserToDb } from '../services/gameService';
import { getBrowserLanguage } from '../services/translations';
import { supabase } from '../lib/supabase';
import StarryBackground from './StarryBackground';
import Login from './Login';
import GameLobby from './GameLobby';
import ActiveGame from './ActiveGame';
import Profile from './Profile';

const VIEW = {
  LOGIN: 'LOGIN',
  LOBBY: 'LOBBY',
  GAME_ROOM: 'GAME_ROOM',
  PROFILE: 'PROFILE'
};

const MainGame = () => {
  const [view, setView] = useState(VIEW.LOGIN);
  const [user, setUser] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [lang, setLang] = useState('fr');
  const [initialGameCode, setInitialGameCode] = useState('');
  const [authLoading, setAuthLoading] = useState(true);

  // Sync URL Logic
  const updateUrl = (newView, gameId = null) => {
      if (typeof window === 'undefined') return;
      let url = '/';
      const params = new URLSearchParams();
      if (newView === VIEW.LOBBY) params.set('page', 'lobby');
      if (newView === VIEW.PROFILE) params.set('page', 'profile');
      if (newView === VIEW.GAME_ROOM && gameId) params.set('game', gameId);
      const queryString = params.toString();
      const finalUrl = queryString ? `/?${queryString}` : '/';
      if (window.location.search !== `?${queryString}`) {
          window.history.pushState({ view: newView, gameId }, '', finalUrl);
      }
  };

  const extractUserFromSession = (sessionUser) => {
      // Logic: Get full name, take only first part.
      const fullName = sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'User';
      const firstName = fullName.split(' ')[0]; // "Jean Dupont" -> "Jean"

      return {
          id: sessionUser.id,
          name: firstName,
          // We do NOT store email or phone. Only UUID, Name, Avatar.
          avatar: sessionUser.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${sessionUser.id}`,
          isGuest: false
      };
  };

  // Initial Load & Auth Check
  useEffect(() => {
    setLang(getBrowserLanguage());
    
    // 1. Check URL Params
    const params = new URLSearchParams(window.location.search);
    const code = params.get('game');
    if (code) setInitialGameCode(code);

    // 2. Check Supabase Session (Real Auth)
    const checkSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            // User is authenticated
            const authUser = extractUserFromSession(session.user);
            // Automatic login from session -> isManual = false
            handleLoginSuccess(authUser, false);
        } else {
            // No Auth Session -> Check LocalStorage for Guest
            const localUser = getLocalUser();
            if (localUser) {
                // Automatic login from local storage -> isManual = false
                handleLoginSuccess(localUser, false);
            } else {
                // No user at all -> Stay on Login
                setAuthLoading(false);
            }
        }
    };

    checkSession();

    // Listen for Auth Changes (e.g. after Google redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
            const authUser = extractUserFromSession(session.user);
            // Save/Sync profile
            await saveUserToDb(authUser); 
            // New login event -> isManual = true (force navigation)
            handleLoginSuccess(authUser, true);
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLoginSuccess = (userData, isManual = false) => {
      setUser(userData);
      saveLocalUser(userData); // Cache logic
      setAuthLoading(false);
      parseUrlAndSetView(userData, isManual);
  };

  const parseUrlAndSetView = (currentUser, isManual) => {
      const params = new URLSearchParams(window.location.search);
      const gameCode = params.get('game') || initialGameCode;
      const page = params.get('page');

      // 1. Priority: Join Game (via Link)
      if (gameCode) {
          joinGame(gameCode, currentUser).then(game => {
              if (game) {
                  setActiveGame(game);
                  setView(VIEW.GAME_ROOM);
              } else {
                  setView(VIEW.LOBBY);
                  updateUrl(VIEW.LOBBY);
              }
          });
          return;
      }

      // 2. Priority: Manual Login (User clicked button) -> Force Lobby
      // This prevents going to 'Profile' if the previous session ended there
      if (isManual) {
          setView(VIEW.LOBBY);
          updateUrl(VIEW.LOBBY);
          return;
      }

      // 3. Priority: Page Restoration (Reload)
      if (page === 'profile') { setView(VIEW.PROFILE); return; }
      
      // Default to Lobby
      setView(VIEW.LOBBY);
      updateUrl(VIEW.LOBBY);
  };

  // Called from Login Component (Guest Flow)
  const handleGuestLogin = async (guestUser) => {
    // We explicitly mark them as guest
    const userWithFlag = { ...guestUser, isGuest: true };
    await saveUserToDb(userWithFlag); // Sync to DB so they can play
    // Manual Guest Login -> isManual = true
    handleLoginSuccess(userWithFlag, true);
  };

  const handleJoinGame = (game) => {
    setActiveGame(game);
    setView(VIEW.GAME_ROOM);
    updateUrl(VIEW.GAME_ROOM, game.id);
  };

  const handleRejoinFromProfile = async (gameId) => {
      if (!user) return;
      const game = await joinGame(gameId, user);
      if (game) {
          setActiveGame(game);
          setView(VIEW.GAME_ROOM);
          updateUrl(VIEW.GAME_ROOM, game.id);
      }
  };

  const handleGameUpdate = (updatedGame) => { setActiveGame(updatedGame); };

  const navigateToLobby = () => { setActiveGame(null); setView(VIEW.LOBBY); updateUrl(VIEW.LOBBY); };
  const navigateToProfile = () => { setView(VIEW.PROFILE); updateUrl(VIEW.PROFILE); };
  const navigateBackFromProfile = () => { activeGame ? setView(VIEW.GAME_ROOM) : setView(VIEW.LOBBY); };

  const handleLogout = () => {
      setUser(null);
      setActiveGame(null);
      setView(VIEW.LOGIN);
      window.history.pushState({}, '', '/');
  };

  if (authLoading) {
      return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-fuchsia-500"></div></div>;
  }

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <StarryBackground />
      <main className="relative z-10">
        {view === VIEW.LOGIN && (
          <Login lang={lang} onLogin={handleGuestLogin} initialCode={initialGameCode} />
        )}

        {view === VIEW.LOBBY && user && (
          <GameLobby 
            user={user} 
            lang={lang}
            activeGame={activeGame}
            onJoinGame={handleJoinGame}
            onNavigateToProfile={navigateToProfile}
          />
        )}

        {view === VIEW.GAME_ROOM && user && activeGame && (
          <ActiveGame 
            initialGame={activeGame} 
            currentUser={user}
            lang={lang}
            onGameUpdate={handleGameUpdate}
            onLeave={navigateToLobby}
            onNavigateToProfile={navigateToProfile}
          />
        )}

        {view === VIEW.PROFILE && user && (
            <Profile 
                user={user}
                lang={lang}
                onBack={navigateBackFromProfile}
                onLogout={handleLogout}
                onLanguageChange={setLang}
                onRejoinGame={handleRejoinFromProfile}
            />
        )}
      </main>
    </div>
  );
};

export default MainGame;
