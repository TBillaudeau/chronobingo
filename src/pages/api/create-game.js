import { nanoid } from 'nanoid';
import { games } from '../../lib/gamesStore';

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { username, gridSize } = req.body;

    if (!username) {
      return res.status(400).json({ message: 'Username is required' });
    }
    
    const finalGridSize = gridSize || 5; // Default to 5x5 if not provided

    const gameId = nanoid(6);
    // Initialize the game with an empty players array and the grid size
    games[gameId] = {
      id: gameId,
      players: [],
      gridSize: finalGridSize,
    };

    console.log(`Game created in store: ${gameId}`);
    res.status(200).json({ gameId });
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
