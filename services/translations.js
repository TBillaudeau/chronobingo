
export const dictionary = {
  fr: {
    login: {
      welcome: "Bienvenue",
      subtitle: "Prépare ta grille, écoute la musique et sois le premier à crier BINGO !",
      placeholderName: "Ton Pseudo",
      placeholderNameInput: "Comment on t'appelle ?",
      placeholderCode: "Code Partie (Optionnel)",
      btnGuest: "Entrer en Invité",
      btnJoin: "Rejoindre la partie",
      or: "OU",
      btnGoogle: "Compte Google"
    },
    lobby: {
      hello: "Bonjour",
      ready: "Prêt à faire chauffer le dancefloor ?",
      logout: "Déconnexion",
      createTitle: "Créer une Partie",
      createDesc: "Deviens le DJ et lance une nouvelle partie pour tes potes.",
      btnCreate: "Lancer la soirée",
      joinTitle: "Rejoindre",
      joinDesc: "Entre le code unique de la partie pour rejoindre.",
      placeholderCode: "Code de la partie (ex: ABCDEF)",
      btnGo: "Go",
      errorNotFound: "Partie introuvable. Vérifie le code.",
      leaderboard: "Top Chansons de Soirée",
      pts: "pts",
      wins: "Parties gagnées",
      plays: "passages",
      returnToGame: "PARTIE EN COURS",
      recentGames: "Reprendre une partie",
      lastPlayed: "Joué il y a",
      host: "DJ",
      modeNoDuplicates: "Mode Sans Doublons",
      modeNoDuplicatesDesc: "Une chanson ne peut être choisie que par un seul joueur."
    },
    game: {
      statusPlaying: "EN COURS",
      statusLobby: "PRÉPARATION",
      statusFinished: "TERMINÉE",
      code: "CODE",
      tabGrid: "Ma Grille",
      tabPlayers: "Classement",
      dragTip: "Glisse les cases pour réorganiser.",
      clickTip: "Clique sur 🎵 pour écouter, ou sur la case pour changer.",
      waitingDj: "En attente du DJ...",
      btnStart: "LANCER LA PARTIE",
      btnFinish: "TERMINER LA PARTIE",
      score: "Ton Score",
      playing: "Joue...",
      searchTitle: "Rechercher un titre...",
      searching: "Recherche sur Deezer...",
      btnAdd: "Ajouter",
      close: "Fermer",
      copied: "Code copié !",
      modalTabSearch: "Recherche",
      modalTabFavs: "Mes Favoris",
      noFavsYet: "Pas encore de favoris. Ajoute des sons depuis la recherche !",
      opponents: "Grilles des Adversaires",
      bingo: "BINGO !",
      gameOver: "PODIUM FINAL",
      winner: "VAINQUEUR",
      rank: "Rang",
      errorDuplicate: "⛔ Cette chanson est déjà prise par un autre joueur !"
    },
    profile: {
      title: "Mon Profil",
      tabHistory: "Historique",
      tabFavs: "Favoris",
      tabSettings: "Paramètres",
      noHistory: "Aucune partie jouée pour l'instant.",
      noFavs: "Aucune musique favorite.",
      lang: "Langue / Language",
      sound: "Effets Sonores",
      btnBack: "Retour",
      btnLogout: "Se Déconnecter",
      won: "Gagné",
      rank: "Rang"
    }
  },
  en: {
    login: {
      welcome: "Welcome",
      subtitle: "Set your grid, listen to the beat, and be the first to scream BINGO!",
      placeholderName: "Your Nickname",
      placeholderNameInput: "What's your name?",
      placeholderCode: "Game Code (Optional)",
      btnGuest: "Enter as Guest",
      btnJoin: "Join Game",
      or: "OR",
      btnGoogle: "Google Account"
    },
    lobby: {
      hello: "Hello",
      ready: "Ready to heat up the dancefloor?",
      logout: "Logout",
      createTitle: "Create Game",
      createDesc: "Be the DJ and start a new party for your friends.",
      btnCreate: "Start Party",
      joinTitle: "Join Game",
      joinDesc: "Enter the unique game code to join.",
      placeholderCode: "Game Code (ex: ABCDEF)",
      btnGo: "Go",
      errorNotFound: "Game not found. Check the code.",
      leaderboard: "Top Party Songs",
      pts: "pts",
      wins: "Games won",
      plays: "plays",
      returnToGame: "GAME IN PROGRESS",
      recentGames: "Resume Playing",
      lastPlayed: "Played",
      host: "DJ",
      modeNoDuplicates: "No Duplicates Mode",
      modeNoDuplicatesDesc: "A song can only be picked by one player."
    },
    game: {
      statusPlaying: "PLAYING",
      statusLobby: "LOBBY",
      statusFinished: "FINISHED",
      code: "CODE",
      tabGrid: "My Grid",
      tabPlayers: "Leaderboard",
      dragTip: "Drag cells to reorder.",
      clickTip: "Click 🎵 to preview, or cell to change song.",
      waitingDj: "Waiting for DJ...",
      btnStart: "START GAME",
      btnFinish: "FINISH GAME",
      score: "Your Score",
      playing: "Playing...",
      searchTitle: "Search a song...",
      searching: "Searching Deezer...",
      btnAdd: "Add",
      close: "Close",
      copied: "Code copied!",
      modalTabSearch: "Search",
      modalTabFavs: "My Favorites",
      noFavsYet: "No favorites yet. Add songs from search!",
      opponents: "Opponents Boards",
      bingo: "BINGO !",
      gameOver: "FINAL PODIUM",
      winner: "WINNER",
      rank: "Rank",
      errorDuplicate: "⛔ This song is already taken by another player!"
    },
    profile: {
      title: "My Profile",
      tabHistory: "History",
      tabFavs: "Favorites",
      tabSettings: "Settings",
      noHistory: "No games played yet.",
      noFavs: "No favorite songs yet.",
      lang: "Language",
      sound: "Sound Effects",
      btnBack: "Back",
      btnLogout: "Logout",
      won: "Won",
      rank: "Rank"
    }
  }
};

export const getBrowserLanguage = () => {
  if (typeof navigator === 'undefined') return 'fr';
  const browserLang = navigator.language.split('-')[0];
  return browserLang === 'fr' ? 'fr' : 'en';
};

export const t = (lang, path) => {
  const keys = path.split('.');
  let current = dictionary[lang];
  
  for (const key of keys) {
    if (current[key] === undefined) return path;
    current = current[key];
  }
  
  return current;
};
