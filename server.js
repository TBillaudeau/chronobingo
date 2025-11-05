const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const games = {}; // In-memory store for games

app.prepare().then(async () => {
  const { nanoid } = await import('nanoid');

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer);

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create-game', (username) => {
      const gameId = nanoid(6);
      const player = { id: socket.id, username, grid: Array(25).fill(null) };
      games[gameId] = {
        players: [player],
      };
      socket.join(gameId);
      console.log(`Game created: ${gameId} by ${username}`);
      socket.emit('game-created', { gameId, player });
      io.to(gameId).emit('update-game-state', games[gameId]);
    });

    socket.on('join-game', ({ gameId, username, isCreator }) => {
      if (games[gameId]) {
        let player;
        // If the user is the creator, they are the first player.
        // Their socket ID needs to be updated upon joining the game page.
        if (isCreator && games[gameId].players.length === 1) {
            games[gameId].players[0].id = socket.id;
            player = games[gameId].players[0];
        } else {
            // Standard join for other players
            const existingPlayer = games[gameId].players.find(p => p.id === socket.id);
            if (!existingPlayer) {
                player = { id: socket.id, username, grid: Array(25).fill(null) };
                games[gameId].players.push(player);
            } else {
                player = existingPlayer; // Player is already in the game
            }
        }
        
        socket.join(gameId);
        console.log(`${username} (${socket.id}) joined game: ${gameId}`);
        socket.emit('game-joined', { gameId, player });
        io.to(gameId).emit('update-game-state', games[gameId]);
      } else {
        socket.emit('error', 'Game not found');
      }
    });

    socket.on('update-grid', ({ gameId, grid }) => {
        if (games[gameId]) {
            const player = games[gameId].players.find(p => p.id === socket.id);
            if (player) {
                player.grid = grid;
                io.to(gameId).emit('update-game-state', games[gameId]);
            }
        }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      for (const gameId in games) {
        const game = games[gameId];
        const playerIndex = game.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
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

  const port = process.env.PORT || 3000;
  httpServer.listen(port, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
