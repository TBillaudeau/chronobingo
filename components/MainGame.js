
import React, { useState, useEffect } from 'react';
import { getLocalUser, joinGame, createGame, getCurrentGameId, saveLocalUser, saveUserToDb, mergeGuestHistory } from '../services/gameService';
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
  const [view, setView] = useState(VIEW.LOBBY);
  const [user, setUser] = useState(null);
  const [activeGame, setActiveGame] = useState(null);
  const [lang, setLang] = useState('fr'); // Function init below
  const [initialGameCode, setInitialGameCode] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [batterySaver, setBatterySaver] = useState(false);

  useEffect(() => {
    // Init Settings from LocalStorage
    const storedLang = localStorage.getItem('cb_lang');
    if (storedLang) setLang(storedLang);
    else setLang(getBrowserLanguage());

    const storedBattery = localStorage.getItem('cb_battery');
    if (storedBattery === 'true') setBatterySaver(true);
  }, []);

  // Persist handlers
  const handleLangChange = (l) => {
    setLang(l);
    localStorage.setItem('cb_lang', l);
  };

  const handleBatteryChange = (val) => {
    setBatterySaver(val);
    localStorage.setItem('cb_battery', val);
  };

  const [pendingAction, setPendingAction] = useState(null);

  // Battery Saver Auto-Detect (Android/Chrome only)
  useEffect(() => {
    if (typeof navigator.getBattery === 'function') {
      navigator.getBattery().then(battery => {
        const checkBattery = () => {
          if (battery.level <= 0.3 && !battery.charging) {
            setBatterySaver(true);
          }
        };
        checkBattery();
        battery.addEventListener('levelchange', checkBattery);
        battery.addEventListener('chargingchange', checkBattery);
      });
    }
  }, []);

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
          // No user at all.
          // IF there is a game code in the URL, we must force them to login/guest screen first.
          if (code) {
            setPendingAction({ type: 'join', code: code });
            setView(VIEW.LOGIN);
          }
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

  const handleLoginSuccess = async (userData, isManual = false) => {
    setUser(userData);
    saveLocalUser(userData); // Cache logic
    setAuthLoading(false);

    // Merge Guest History if this is a real user and there is history pending
    if (!userData.isGuest) {
      // Logic inside handles empty guest history gracefully
      await mergeGuestHistory(userData.id);
    }

    // Handle Pending Actions (Create/Join after login)
    if (pendingAction) {
      if (pendingAction.type === 'create') {
        const game = await createGame(userData, { allowLateJoin: true, noDuplicates: pendingAction.noDuplicates });
        setActiveGame(game);
        setView(VIEW.GAME_ROOM);
        updateUrl(VIEW.GAME_ROOM, game.id);
        setPendingAction(null);
        return;
      } else if (pendingAction.type === 'join') {
        const game = await joinGame(pendingAction.code, userData);
        if (game) {
          setActiveGame(game);
          setView(VIEW.GAME_ROOM);
          updateUrl(VIEW.GAME_ROOM, game.id);
        } else {
          // Failed to join
          setView(VIEW.LOBBY);
          updateUrl(VIEW.LOBBY);
        }
        setPendingAction(null);
        return;
      }
    }

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
  const navigateBackFromProfile = () => {
    if (activeGame) {
      setView(VIEW.GAME_ROOM);
      updateUrl(VIEW.GAME_ROOM, activeGame.id);
    } else {
      setView(VIEW.LOBBY);
      updateUrl(VIEW.LOBBY);
    }
  };

  const handleRequestLogin = (action) => {
    setPendingAction(action);
    setView(VIEW.LOGIN);
  };

  const handleLogout = () => {
    setUser(null);
    setActiveGame(null);
    setView(VIEW.LOBBY); // Go to Lobby instead of Login
    window.history.pushState({}, '', '/');
  };

  if (authLoading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-4 border-fuchsia-500"></div></div>;
  }

  return (
    <div className={`min-h-screen text-white relative overflow-hidden ${batterySaver ? 'bg-black' : ''}`}>
      {!batterySaver && <StarryBackground />}
      <main className="relative z-10">
        {view === VIEW.LOGIN && (
          <Login lang={lang} onLogin={handleGuestLogin} initialCode={initialGameCode} />
        )}

        {view === VIEW.LOBBY && (
          <GameLobby
            user={user}
            lang={lang}
            activeGame={activeGame}
            onJoinGame={handleJoinGame}
            onNavigateToProfile={navigateToProfile}
            onRequestLogin={handleRequestLogin}
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
            onBack={() => {
              // If we have an active game, go back to it
              if (activeGame) {
                updateUrl(VIEW.GAME_ROOM, activeGame.id);
                setView(VIEW.GAME_ROOM);
              } else {
                updateUrl(VIEW.LOBBY);
                setView(VIEW.LOBBY);
              }
            }}
            onLogout={handleLogout}
            onLanguageChange={handleLangChange}
            onRejoinGame={async (gameId) => {
              // Determine if guest or user
              const userToJoin = user;
              // Reuse the game load logic directly or just update URL which triggers the join effect?
              // Better: Explicitly call join
              try {
                setAuthLoading(true);
                const game = await joinGame(gameId, userToJoin.id);
                if (game) {
                  setActiveGame(game);
                  setView(VIEW.GAME_ROOM);
                  updateUrl(VIEW.GAME_ROOM, game.id);
                }
              } catch (e) {
                console.error("Rejoin failed", e);
                alert("Impossible de rejoindre la partie (elle est peut-être finie).");
              } finally {
                setAuthLoading(false);
              }
            }}
            batterySaver={batterySaver}
            setBatterySaver={handleBatteryChange}
          />
        )}
      </main>
    </div>
  );
};

export default MainGame;
