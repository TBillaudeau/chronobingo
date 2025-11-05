import { Server } from 'socket.io';
import { games } from '../../lib/gamesStore';

const calculateScore = (grid, gridSize) => {
  if (!grid) return 0;

  const size = gridSize;
  if (grid.length !== size * size) {
    return 0; // Grid size doesn't match
  }

  let score = 0;
  let completedLines = 0;

  // Check rows
  for (let i = 0; i < size; i++) {
    let rowComplete = true;
    for (let j = 0; j < size; j++) {
      const cell = grid[i * size + j];
      if (!cell || !cell.checked) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) {
      score += 1;
      completedLines++;
    }
  }

  // Check columns
  for (let j = 0; j < size; j++) {
    let colComplete = true;
    for (let i = 0; i < size; i++) {
      const cell = grid[i * size + j];
      if (!cell || !cell.checked) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) {
      score += 1;
      completedLines++;
    }
  }

  // Check diagonal (top-left to bottom-right)
  let diag1Complete = true;
  for (let i = 0; i < size; i++) {
    const cell = grid[i * size + i];
    if (!cell || !cell.checked) {
      diag1Complete = false;
      break;
    }
  }
  if (diag1Complete) {
    score += 3;
    completedLines++;
  }

  // Check diagonal (top-right to bottom-left)
  let diag2Complete = true;
  for (let i = 0; i < size; i++) {
    const cell = grid[i * size + (size - 1 - i)];
    if (!cell || !cell.checked) {
      diag2Complete = false;
      break;
    }
  }
  if (diag2Complete) {
    score += 3;
    completedLines++;
  }

  // Bonus for full grid
  const totalPossibleLines = size * 2 + 2;
  if (completedLines >= totalPossibleLines) {
    score += 5;
  }

  return score;
};

const SocketHandler = (req, res) => {
  if (res.socket.server.io) {
    console.log('Socket is already running');
  } else {
    console.log('Socket is initializing');
    const io = new Server(res.socket.server, {
        path: "/api/socket",
    });
    res.socket.server.io = io;

    io.on('connection', (socket) => {
      console.log('Socket connected:', socket.id);

      socket.on('join-game', ({ gameId, username }) => {
        if (!games[gameId]) {
          console.error(`Attempted to join non-existent game: ${gameId}`);
          socket.emit('error', 'Game not found');
          return;
        }

        socket.join(gameId);
        
        const game = games[gameId];
        const gridSize = game.gridSize || 5;
        const gridCellCount = gridSize * gridSize;

        let player;
        const existingPlayerIndex = game.players.findIndex(p => p.username === username);

        if (existingPlayerIndex !== -1) {
            // Player is reconnecting, update their socket ID
            game.players[existingPlayerIndex].id = socket.id;
            player = game.players[existingPlayerIndex];
            console.log(`Player ${username} reconnected to game ${gameId} with new socket ID ${socket.id}`);
        } else {
            // New player is joining
            player = { id: socket.id, username, grid: Array(gridCellCount).fill(null), score: 0 };
            game.players.push(player);
            console.log(`Player ${username} joined game ${gameId} for the first time`);
        }

        socket.emit('game-joined', { gameId, player });
        io.to(gameId).emit('update-game-state', game);
      });

      socket.on('leave-game', ({ gameId }) => {
        if (games[gameId]) {
          const playerIndex = games[gameId].players.findIndex((p) => p.id === socket.id);
          if (playerIndex !== -1) {
            const username = games[gameId].players[playerIndex].username;
            games[gameId].players.splice(playerIndex, 1);
            console.log(`Player ${username} left game ${gameId}`);
            socket.leave(gameId);
            io.to(gameId).emit('update-game-state', games[gameId]);
          }
        }
      });

      socket.on('update-grid', ({ gameId, grid }) => {
        const game = games[gameId];
        if (game) {
          const player = game.players.find((p) => p.id === socket.id);
          if (player) {
            player.grid = grid;
            player.score = calculateScore(grid, game.gridSize); // Calculate and update score
            io.to(gameId).emit('update-game-state', game);
          }
        }
      });

      socket.on('disconnect', () => {
        console.log('Socket disconnected:', socket.id);
        for (const gameId in games) {
          const game = games[gameId];
          const playerIndex = game.players.findIndex((p) => p.id === socket.id);
          if (playerIndex !== -1) {
            const username = game.players[playerIndex].username;
            console.log(`Player ${username} disconnected from game ${gameId}`);
            game.players.splice(playerIndex, 1);
            if (game.players.length === 0) {
              console.log(`Game ${gameId} is empty, deleting.`);
              delete games[gameId];
            } else {
              io.to(gameId).emit('update-game-state', game);
            }
            break;
          }
        }
      });
    });
  }
  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default SocketHandler;
