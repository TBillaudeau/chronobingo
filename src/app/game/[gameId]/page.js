"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { translations } from '@/lib/translations';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import io from 'socket.io-client';
import { Home, Link as LinkIcon, Users, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DraggableSong } from '@/components/DraggableSong';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search, X } from "lucide-react";
import { Audiowide } from 'next/font/google';

const audiowide = Audiowide({
  weight: '400',
  subsets: ['latin'],
});

let socket;

// Search Dialog Component (similar to before)
function SearchDialog({ onSelectSong, lang = 'fr' }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [songs, setSongs] = useState([]);
  const timerRef = useRef();

  const searchSongs = async () => {
    if (!searchTerm) return;
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      setSongs(data.data || []);
    } catch (error) {
      console.error("Error fetching songs:", error);
    }
  };

  useEffect(() => {
    if (!searchTerm) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      searchSongs();
    }, 2000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [searchTerm]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{translations[lang].addSong}</DialogTitle>
      </DialogHeader>
      <div className="flex gap-2 my-4">
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={translations[lang].searchSongPlaceholder}
          className="bg-gray-800 border-gray-700 text-white"
          onKeyPress={(e) => e.key === 'Enter' && searchSongs()}
        />
        <Button onClick={searchSongs} className="bg-pink-600 hover:bg-pink-700">
          <Search className="h-4 w-4" />
        </Button>
      </div>
      {songs.length > 0 && (
        <div className="mt-4 max-h-60 overflow-y-auto">
          <ul>
            {songs.map((song) => (
              <li key={song.id} className="flex items-center justify-between p-2 hover:bg-gray-700 rounded-md cursor-pointer" onClick={() => onSelectSong(song)}>
                <div className="flex items-center gap-4">
                  <img src={song.album.cover_small} alt={song.album.title} className="h-10 w-10 rounded" />
                  <div>
                    <p className="font-bold">{song.title}</p>
                    <p className="text-sm text-gray-400">{song.artist.name}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

const getCompletedLines = (grid, gridSize) => {
  if (!grid) return [];
  const size = gridSize;
  const completed = new Set();

  const checkLine = (indices) => {
    if (indices.some(i => i >= grid.length)) return false; // Out of bounds
    const isComplete = indices.every(i => grid[i] && grid[i].checked);
    if (isComplete) {
      indices.forEach(i => completed.add(i));
    }
    return isComplete;
  };

  // Check rows
  for (let i = 0; i < size; i++) {
    const indices = Array.from({ length: size }, (_, k) => i * size + k);
    checkLine(indices);
  }

  // Check columns
  for (let j = 0; j < size; j++) {
    const indices = Array.from({ length: size }, (_, k) => k * size + j);
    checkLine(indices);
  }

  // Check diagonals
  const diag1Indices = Array.from({ length: size }, (_, k) => k * size + k);
  checkLine(diag1Indices);

  const diag2Indices = Array.from({ length: size }, (_, k) => k * size + (size - 1 - k));
  checkLine(diag2Indices);

  return Array.from(completed);
};


export default function GamePage({ lang = 'fr' }) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { gameId } = params;
  const usernameFromQuery = searchParams.get('username');

  const [username, setUsername] = useState(usernameFromQuery || "");
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [player, setPlayer] = useState(null);
  // Sauvegarde et restauration de la grille du joueur
  const LOCAL_KEY = `chronobingo_grid_${gameId}_${usernameFromQuery || ''}`;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currentGridIndex, setCurrentGridIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [completedCells, setCompletedCells] = useState([]);
  const prevScoreRef = useRef();

  // Sauvegarder la grille à chaque modification
  useEffect(() => {
    if (player && player.grid) {
      try {
        localStorage.setItem(LOCAL_KEY, JSON.stringify(player.grid));
      } catch {}
    }
    if (player && gameState) {
      const newCompletedCells = getCompletedLines(player.grid, gameState.gridSize);
      setCompletedCells(newCompletedCells);
    }
  }, [player?.grid, gameState]);

  useEffect(() => {
    if (player && prevScoreRef.current !== undefined && player.score > prevScoreRef.current) {
      setIsCelebrating(true);
      const timer = setTimeout(() => setIsCelebrating(false), 300); // Duration of the animation
      return () => clearTimeout(timer);
    }
    prevScoreRef.current = player?.score;
  }, [player?.score]);

  const socketInitializer = useCallback(() => {
    // Prevent multiple initializations
    if (socket) return;

    socket = io(undefined, {
        path: '/api/socket',
    });

    socket.on('connect', () => {
      console.log('Connected to socket server with id:', socket.id);
      socket.emit('join-game', { gameId, username: username || usernameFromQuery });
    });

    socket.on('game-joined', ({ player }) => {
      setPlayer(player);
    });

    socket.on('update-game-state', (newGameState) => {
      setGameState(newGameState);
      const currentPlayer = newGameState.players.find(p => p.id === socket.id);
      if (currentPlayer) {
        // Forcer la mise à jour de l'état du joueur, y compris la grille
        setPlayer(prevPlayer => ({ ...prevPlayer, ...currentPlayer }));
      }
    });

    socket.on('error', (message) => {
      alert(message);
      router.push('/');
    });
  }, [gameId, username, usernameFromQuery, router]);

  useEffect(() => {
    if (!usernameFromQuery) {
      setShowJoinModal(true);
    } else {
      setShowJoinModal(false);
      // Restaure la grille locale si elle existe
      const savedGrid = localStorage.getItem(LOCAL_KEY);
      if (savedGrid) {
        // Attend que le joueur soit reçu du serveur pour merger la grille
        const mergeGrid = (playerObj) => {
          try {
            const grid = JSON.parse(savedGrid);
            if (Array.isArray(grid) && playerObj) {
              setPlayer(prev => ({ ...playerObj, grid }));
              // Envoie la grille restaurée au serveur
              socket.emit('update-grid', { gameId, grid });
            }
          } catch {}
        };
        // Patch le socketInitializer pour merger après réception du joueur
        const originalSocketInitializer = socketInitializer;
        const patchedSocketInitializer = () => {
          originalSocketInitializer();
          if (socket) {
            socket.on('game-joined', ({ player }) => {
              mergeGrid(player);
            });
          }
        };
        patchedSocketInitializer();
      } else {
        socketInitializer();
      }
    }
    return () => {
      if (socket) {
        console.log('Disconnecting socket...');
        socket.disconnect();
        socket = null;
      }
    };
  }, [usernameFromQuery, socketInitializer]);

  const handleJoinGame = (e) => {
    e.preventDefault();
    if (username.trim()) {
        router.push(`/game/${gameId}?username=${username.trim()}`);
    }
  }

  const handleLeaveGame = () => {
    if (socket) {
      socket.emit('leave-game', { gameId });
    }
    router.push('/');
  };

  const updateGrid = (newGrid) => {
    if (!player) return;
    const updatedPlayer = { ...player, grid: newGrid };
    setPlayer(updatedPlayer);
    socket.emit('update-grid', { gameId, grid: newGrid });
  };

  const handleOpenDialog = (index) => {
    setCurrentGridIndex(index);
    setDialogOpen(true);
  };

  const handleSelectSong = (song) => {
    if (currentGridIndex !== null && player) {
      const newGrid = [...player.grid];
      newGrid[currentGridIndex] = { ...song, checked: false };
      updateGrid(newGrid);
    }
    setDialogOpen(false);
    setCurrentGridIndex(null);
  };

  const toggleSongChecked = (index) => {
    if (player) {
      const newGrid = [...player.grid];
      if (newGrid[index]) {
        newGrid[index].checked = !newGrid[index].checked;
        updateGrid(newGrid);
      }
    }
  };

  const removeSong = (index, e) => {
    e.stopPropagation();
    if (player) {
      const newGrid = [...player.grid];
      newGrid[index] = null;
      updateGrid(newGrid);
    }
  };

  const moveSong = useCallback((dragIndex, hoverIndex) => {
    if (player) {
        const newGrid = [...player.grid];
        const dragItem = newGrid[dragIndex];
        newGrid.splice(dragIndex, 1);
        newGrid.splice(hoverIndex, 0, dragItem);
        updateGrid(newGrid);
    }
  }, [player]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href.split('?')[0]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (showJoinModal) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-full max-w-sm bg-gray-800 p-8 rounded-lg shadow-2xl">
          <h2 className="text-2xl font-bold text-center text-white mb-6">{translations[lang].joinGame} <span className="text-pink-500">{gameId}</span></h2>
          <form onSubmit={handleJoinGame}>
            <div className="mb-6">
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={translations[lang].usernamePlaceholder}
                className="bg-gray-700 border-gray-600 text-white text-center text-lg h-12"
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700 h-12 text-lg">
              {translations[lang].join}
            </Button>
          </form>
        </div>
      </div>
    )
  }

  if (!gameState || !player) {
    return <div className="flex items-center justify-center min-h-screen">{translations[lang].loading}</div>;
  }

  const gridSize = gameState?.gridSize || 5;
  const gridStyle = {
    gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
  };

  const otherPlayers = gameState.players.filter(p => p.id !== player.id);

  return (
    <main className="container mx-auto p-2 sm:p-4 relative z-10">
      <header className="flex flex-col sm:flex-row justify-between items-center my-4 gap-4 sm:gap-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-center"><span onClick={() => router.push('/')} className={`cursor-pointer ${audiowide.className}`}>{translations[lang].title}</span> - <span className="text-pink-500">{gameId}</span></h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={copyLink}>
            <LinkIcon className="mr-2 h-4 w-4 cursor-pointer" /> {copied ? translations[lang].copied : translations[lang].invite}
          </Button>
          <div className="relative group">
            <Button variant="outline"><Users className="mr-2 h-4 w-4"/> {gameState.players.length}</Button>
            <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-lg p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto z-10">
              <ul className="text-white">
                {gameState.players.sort((a, b) => b.score - a.score).map(p => <li key={p.id} className="p-1 flex justify-between"><span>{p.username} {p.id === player.id && (lang === 'fr' ? '(Vous)' : '(You)')}</span> <span className="font-bold text-pink-500">{p.score} {translations[lang].points}</span></li>)}
              </ul>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={handleLeaveGame}>
            <LogOut className="mr-2 h-4 w-4 cursor-pointer" /> {translations[lang].quit}
          </Button>
        </div>
      </header>

      <h2 className="text-xl sm:text-2xl font-semibold text-center mb-4">{player.username} - <span className="text-pink-500">{player.score} {translations[lang].points}</span></h2>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <div className={`grid gap-1 sm:gap-2 max-w-2xl mx-auto ${isCelebrating ? 'vibrate' : ''}`} style={gridStyle}>
          {player.grid.map((song, index) => (
            <DraggableSong key={`${song?.id}-${index}`} index={index} song={song} moveSong={moveSong}>
              <DialogTrigger asChild>
                <div
                  onClick={() => handleOpenDialog(index)}
                  className={`aspect-square flex items-center justify-center text-center p-2 rounded-lg transition-all duration-300 relative group
                    ${song ? 'bg-gray-800 cursor-grab' : 'bg-gray-800/50 border-2 border-dashed border-gray-700 cursor-pointer'}
                    ${song?.checked ? 'bg-pink-600 scale-105 shadow-lg shadow-pink-600/30' : ''}
                    ${completedCells.includes(index) ? 'flash' : ''}
                  `}
                >
                  {song ? (
                    <>
                      <div 
                        className="absolute inset-0 rounded-lg opacity-20 group-hover:opacity-30 transition-opacity"
                        style={{ backgroundImage: `url(${song.album.cover_medium})`, backgroundSize: 'cover', backgroundPosition: 'center', width: '100%', height: '100%' }}
                      ></div>
                      <div onClick={(e) => { e.stopPropagation(); toggleSongChecked(index); }} className="relative z-10 w-full h-full flex flex-col items-center justify-center p-1 bg-black/20 rounded-lg overflow-hidden">
                        <p className={`font-bold text-[10px] sm:text-sm leading-tight text-shadow-lg ${song.checked ? 'text-white' : 'text-white'} truncate w-full`}>{song.title}</p>
                        <p className={`text-[9px] sm:text-xs text-gray-300 text-shadow-md ${song.checked ? 'text-gray-100' : ''} truncate w-full`}>{song.artist.name}</p>
                      </div>
                      <button onClick={(e) => removeSong(index, e)} className="absolute top-1 right-1 bg-gray-900/50 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <X className="h-3 w-3 text-gray-400"/>
                      </button>
                    </>
                  ) : (
                    <span className="text-gray-500 text-3xl">+</span>
                  )}
                </div>
              </DialogTrigger>
            </DraggableSong>
          ))}
        </div>
        <DialogContent className="bg-gray-900 border-gray-700 text-white">
          <SearchDialog onSelectSong={handleSelectSong} lang={lang} />
        </DialogContent>
      </Dialog>

      <div className="mt-12 sm:mt-16">
        <h2 className="text-xl sm:text-2xl font-semibold text-center mb-4">{translations[lang].otherPlayersGrids}</h2>
        {otherPlayers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            {otherPlayers.map(p => (
              <div key={p.id}>
                <h3 className="text-lg sm:text-xl font-bold text-center mb-2">{p.username} - <span className="text-pink-500">{p.score} {translations[lang].points}</span></h3>
                <div className={`grid gap-1`} style={gridStyle}>
                  {p.grid.map((song, index) => (
                    <div key={`${p.id}-${index}`} className={`aspect-square flex items-center justify-center text-center p-1 rounded-md relative group
                      ${song ? 'bg-gray-800' : 'bg-gray-800/30'}
                      ${song?.checked ? 'bg-pink-600 scale-105' : ''}
                    `}>
                      {song && (
                        <>
                          <div 
                            className="absolute inset-0 bg-cover bg-center rounded-lg opacity-20"
                            style={{ backgroundImage: `url(${song.album.cover_medium})` }}
                          ></div>
                          <div className="relative z-10 w-full h-full flex flex-col items-center justify-center p-1 bg-black/20 rounded-lg">
                            <p className="font-bold text-[10px] sm:text-sm leading-tight text-shadow-lg">{song.title}</p>
                            <p className="text-[9px] sm:text-xs text-gray-300 text-shadow-md">{song.artist.name}</p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500">{translations[lang].alone}</p>
        )}
      </div>
    </main>
  );
}
