"use client";

import { useState, useEffect } from "react";
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Audiowide } from 'next/font/google';

const audiowide = Audiowide({
  weight: '400',
  subsets: ['latin'],
});

export default function Home() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [gameId, setGameId] = useState("");
  const [gridSize, setGridSize] = useState("4");

  useEffect(() => {
    // Pre-connect to the socket server to initialize it on the server
    fetch('/api/socket');
  }, []);

  const createGame = async () => {
    if (!username.trim()) {
      alert("Veuillez entrer un nom d'utilisateur.");
      return;
    }
    try {
      const res = await fetch('/api/create-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, gridSize: Number(gridSize) }),
      });
      if (!res.ok) {
        throw new Error('Server responded with an error');
      }
      const { gameId } = await res.json();
      router.push(`/game/${gameId}?username=${username}`);
    } catch (error) {
      console.error("Failed to create game:", error);
      alert("Erreur lors de la création de la partie.");
    }
  };

  const joinGame = () => {
    if (username.trim() && gameId.trim()) {
      router.push(`/game/${gameId}?username=${username}`);
    } else {
      alert("Veuillez entrer un nom d'utilisateur et un ID de partie.");
    }
  };

  return (
    <main className="container mx-auto p-4 min-h-screen flex items-center justify-center overflow-hidden">
      <div className="w-full max-w-md flex flex-col justify-center" style={{ minHeight: '80vh' }}>
        <header className="text-center mb-8">
          <h1 className={`text-5xl font-bold ${audiowide.className}`}>Chronobingo</h1>
          <p className="text-xl text-gray-400 mt-2">Le bingo des chansons de soirée</p>
        </header>
        <div className="bg-gray-800 p-6 sm:p-8 rounded-lg shadow-2xl flex flex-col justify-center">
          <h2 className="text-2xl font-bold text-center text-white mb-6">Entrez dans le jeu</h2>
          <div className="mb-6">
            <Input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Votre nom d'utilisateur"
              className="bg-gray-700 border-gray-600 text-white text-center text-lg h-12"
              onFocus={e => e.target.scrollIntoView({ block: 'center' })}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (gameId) joinGame();
                  else createGame();
                }
              }}
            />
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Button onClick={createGame} className="bg-pink-600 hover:bg-pink-700 h-12 text-lg w-full">
                Créer une nouvelle partie
              </Button>
              <Select onValueChange={(value) => setGridSize(value)} value={gridSize}>
                <SelectTrigger className="w-[120px] h-12 bg-gray-700 border-gray-600 text-white">
                  <SelectValue placeholder="Taille" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 text-white border-gray-600">
                  <SelectGroup>
                    <SelectItem value="3">3x3</SelectItem>
                    <SelectItem value="4">4x4</SelectItem>
                    <SelectItem value="5">5x5</SelectItem>
                    <SelectItem value="6">6x6</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <hr className="w-full border-gray-600"/>
              <span className="text-gray-400">OU</span>
              <hr className="w-full border-gray-600"/>
            </div>
            <div className="flex gap-2">
              <Input
                type="text"
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                placeholder="ID de la partie"
                className="bg-gray-700 border-gray-600 text-white h-12"
                onFocus={e => e.target.scrollIntoView({ block: 'center' })}
                onKeyPress={(e) => e.key === 'Enter' && joinGame()}
              />
              <Button onClick={joinGame} variant="secondary" className="h-12">
                Rejoindre
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
