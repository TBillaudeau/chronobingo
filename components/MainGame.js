
import React, { useState, useEffect } from 'react';
import { getLocalUser, joinGame, getCurrentGameId, saveLocalUser } from '../services/gameService';
import { getBrowserLanguage } from '../services/translations';
import StarryBackground from './StarryBackground';
import Login from './Login';
import GameLobby from './GameLobby';
import ActiveGame from './ActiveGame';
import Profile from './Profile';

// Constants for Views
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

  // --- NAVIGATION HELPER ---
  // Updates the URL without reloading the page
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

  // 1. Initial Load & Browser Navigation Handling
  useEffect(() => {
    setLang(getBrowserLanguage());
    
    const handlePopState = (event) => {
        // Handle Back/Forward buttons
        if (event.state) {
            // Restore view from history state if available
            // We rely on the logic below to re-validate user/game availability
            parseUrlAndSetView(); 
        } else {
            parseUrlAndSetView();
        }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial Check
    const existingUser = getLocalUser();
    if (existingUser) {
        setUser(existingUser);
        parseUrlAndSetView(existingUser);
    } else {
        // Capture game code if present for later login
        const params = new URLSearchParams(window.location.search);
        const code = params.get('game');
        if (code) setInitialGameCode(code);
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Logic to determine View based on URL + User State
  const parseUrlAndSetView = (currentUser = user) => {
      if (!currentUser) return; // Stay on Login if no user

      const params = new URLSearchParams(window.location.search);
      const gameCode = params.get('game');
      const page = params.get('page');

      // Priority 1: Game Code in URL
      if (gameCode) {
          // If we are already in this game, just ensure view is correct
          // If not, we try to join (auto-reconnect logic)
          const savedGameId = getCurrentGameId();
          
          // If URL matches saved game, use saved game logic to reconnect
          if (savedGameId === gameCode) {
              joinGame(gameCode, currentUser)
                .then(game => {
                    if (game) {
                        setActiveGame(game);
                        setView(VIEW.GAME_ROOM);
                    } else {
                        // Game invalid
                        setView(VIEW.LOBBY);
                        updateUrl(VIEW.LOBBY);
                    }
                })
                .catch(() => {
                    setView(VIEW.LOBBY);
                    updateUrl(VIEW.LOBBY);
                });
          } else {
              // URL has a game code, but it's not the one in local storage.
              // We should probably let the user join it explicitly or auto-join?
              // For safety, if it's different, we go to Lobby but pre-fill might be handled elsewhere.
              // Let's try to join it directly if it's a deep link
              joinGame(gameCode, currentUser).then(game => {
                  if (game) {
                      setActiveGame(game);
                      setView(VIEW.GAME_ROOM);
                  } else {
                      setView(VIEW.LOBBY);
                      updateUrl(VIEW.LOBBY);
                  }
              });
          }
          return;
      }

      // Priority 2: Pages
      if (page === 'profile') {
          setView(VIEW.PROFILE);
          return;
      }
      
      if (page === 'lobby') {
          setView(VIEW.LOBBY);
          return;
      }

      // Default: Check if we have a saved game locally even if URL is empty
      const savedGameId = getCurrentGameId();
      if (savedGameId) {
          updateUrl(VIEW.GAME_ROOM, savedGameId);
          joinGame(savedGameId, currentUser).then(game => {
              if (game) {
                  setActiveGame(game);
                  setView(VIEW.GAME_ROOM);
              } else {
                  setView(VIEW.LOBBY);
                  updateUrl(VIEW.LOBBY);
              }
          });
      } else {
          setView(VIEW.LOBBY);
          updateUrl(VIEW.LOBBY);
      }
  };


  // 2. Handle Login
  const handleLogin = async (newUser, gameCode) => {
    setUser(newUser);
    saveLocalUser(newUser);
    
    const targetCode = gameCode || initialGameCode;

    if (targetCode && targetCode.trim().length > 0) {
      try {
        const game = await joinGame(targetCode, newUser);
        if (game) {
          setActiveGame(game);
          setView(VIEW.GAME_ROOM);
          updateUrl(VIEW.GAME_ROOM, game.id);
        } else {
          alert("Code invalide ou partie introuvable !");
          setView(VIEW.LOBBY);
          updateUrl(VIEW.LOBBY);
        }
      } catch (e) {
        console.error(e);
        alert("Erreur de connexion.");
        setView(VIEW.LOBBY);
        updateUrl(VIEW.LOBBY);
      }
    } else {
      setView(VIEW.LOBBY);
      updateUrl(VIEW.LOBBY);
    }
  };

  // 3. Handle Joining from Lobby
  const handleJoinGame = (game) => {
    setActiveGame(game);
    setView(VIEW.GAME_ROOM);
    updateUrl(VIEW.GAME_ROOM, game.id);
  };

  // 4. Handle Rejoin from Profile History
  const handleRejoinFromProfile = async (gameId) => {
      if (!user) return;
      try {
          const game = await joinGame(gameId, user);
          if (game) {
              setActiveGame(game);
              setView(VIEW.GAME_ROOM);
              updateUrl(VIEW.GAME_ROOM, game.id);
          } else {
              alert("Impossible de rejoindre (Partie introuvable)");
          }
      } catch (e) {
          console.error(e);
          alert("Erreur technique.");
      }
  };

  // 5. Sync Game State
  const handleGameUpdate = (updatedGame) => {
    setActiveGame(updatedGame);
  };

  // 6. Navigation Wrappers that sync URL
  const navigateToLobby = () => {
      setActiveGame(null);
      setView(VIEW.LOBBY);
      updateUrl(VIEW.LOBBY);
  };

  const navigateToProfile = () => {
      setView(VIEW.PROFILE);
      updateUrl(VIEW.PROFILE);
  };
  
  const navigateBackFromProfile = () => {
      if (activeGame) {
          setView(VIEW.GAME_ROOM);
          updateUrl(VIEW.GAME_ROOM, activeGame.id);
      } else {
          setView(VIEW.LOBBY);
          updateUrl(VIEW.LOBBY);
      }
  };

  const handleLogout = () => {
      setUser(null);
      setActiveGame(null);
      setView(VIEW.LOGIN);
      window.history.pushState({}, '', '/'); // Clean URL
  };

  return (
    <div className="min-h-screen text-white relative overflow-hidden">
      <StarryBackground />
      
      <main className="relative z-10">
        {view === VIEW.LOGIN && (
          <Login lang={lang} onLogin={handleLogin} initialCode={initialGameCode} />
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
