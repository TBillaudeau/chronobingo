# 🕺 CHRONOBINGO 💃

A real-time multiplayer music bingo game for your parties.

## 📸 Screenshots

*Add your screenshots here*

![Lobby Screenshot](./screenshots/lobby.png)
![Game Screenshot](./screenshots/game.png)

## ✨ Key Features

- **Real-time Multiplayer**: Play with friends using unique game codes
- **Deezer Integration**: Search millions of songs with 30-second previews
- **Individual Grid Lock**: Each player locks their grid when ready
- **Host Powers**: Unlock grids, kick players, save games
- **Guest & Google Auth**: Play instantly or save your stats
- **PWA Ready**: Install as a native app on mobile
- **Bilingual**: Full support for French and English

## 🚀 Quick Start

### 1. Database Setup (Supabase)

1. Create a project on [Supabase](https://supabase.com)
2. Go to **SQL Editor** and run the following script:

```sql
-- 1. Game States Table
create table gamestates (
  id text primary key,
  data jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. User Profiles Table
create table profiles (
  id text primary key,
  name text,
  avatar text,
  favorites jsonb default '[]',
  history jsonb default '[]',
  settings jsonb default '{}',
  stats jsonb default '{"games_played": 0, "games_won": 0, "songs_chosen": 0, "bingos": 0}',
  song_stats jsonb default '{}',
  updated_at timestamp with time zone default now()
);

-- 3. Global Songs Leaderboard
create table global_songs (
  id text primary key,
  title text,
  artist text,
  cover text,
  preview text,
  play_count int default 1,
  last_played_at timestamp with time zone default now(),
  validation_count int default 0
);

-- 4. Disable RLS (for development/small private deployments)
alter table gamestates disable row level security;
alter table profiles disable row level security;
alter table global_songs disable row level security;
```

3. Enable **Realtime**: Go to `Database` → `Replication` → Enable `Insert/Update/Delete` for `gamestates`

### 2. Google Authentication Setup

1. **Supabase**: Go to `Authentication` > `Providers` > `Google`. Copy the "Callback URL"
2. **Google Cloud Console**: Create a project, go to `APIs & Services` > `Credentials` > `Create OAuth Client ID`
   - Type: Web Application
   - Authorized redirect URIs: Paste the Supabase callback URL
3. **Supabase**: Paste the `Client ID` and `Client Secret` from Google and enable the provider
4. **Supabase URL Config**: Go to `Authentication` > `URL Configuration`
   - Site URL: `http://localhost:3000` (or your production URL)
   - Redirect URLs: Add `http://localhost:3000/**` (and your production URL)

### 3. Environment Variables

Create a `.env.local` file at the root:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 4. Installation & Launch

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Access the app at `http://localhost:3000` (or your local IP from mobile devices on the same network)

## 🔌 External APIs

| API | Purpose | Documentation |
|-----|---------|---------------|
| **Deezer** | Music search, previews, album covers | [Deezer API](https://developers.deezer.com/api) |
| **DiceBear** | Random avatar generation for guest users | [DiceBear API](https://www.dicebear.com/) |
| **Supabase** | Database, authentication, real-time sync | [Supabase Docs](https://supabase.com/docs) |

## 📱 PWA Installation

On mobile devices:
- **iOS**: Safari → Share → Add to Home Screen
- **Android**: Chrome → Menu → Install App

## 📄 License

MIT License - Feel free to use this for your parties!

## 🙏 Credits

- Music data provided by [Deezer](https://www.deezer.com)
- Avatars by [DiceBear](https://dicebear.com) (CC BY 4.0)
