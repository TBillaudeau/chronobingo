
# 🕺 DISCO BINGO 2025 💃

Le jeu de bingo musical ultime pour vos soirées.

## 🚀 Installation Rapide

### 1. Prérequis Base de données (Supabase)

1. Créez un projet sur [Supabase](https://supabase.com).
2. Allez dans le **SQL Editor** et exécutez le script suivant pour créer toutes les tables nécessaires :

   ```sql
   -- 1. Table Principale (Etat du jeu)
   create table gamestates (
     id text primary key,
     data jsonb,
     updated_at timestamp with time zone default timezone('utc'::text, now())
   );

   -- 2. Table des profils joueurs (Stats, Favoris, Historique)
   create table profiles (
     id text primary key,
     name text,
     avatar text,
     favorites jsonb default '[]',
     history jsonb default '[]',
     settings jsonb default '{}',
     stats jsonb default '{"games_played": 0, "games_won": 0, "songs_chosen": 0, "bingos": 0}',
     updated_at timestamp with time zone default now()
   );

   -- 3. Table des chansons (Leaderboard Global)
   create table global_songs (
     id text primary key, -- Deezer ID
     title text,
     artist text,
     cover text,
     preview text,
     play_count int default 1,
     last_played_at timestamp with time zone default now(),
     validation_count int default 0
   );

   -- 4. Ajouter les stats détaillées par chanson (Si table profiles existe déjà)
   alter table profiles add column song_stats jsonb default '{}';

   -- 5. Désactiver la sécurité restrictive (Mode Invité)
   alter table gamestates disable row level security;
   alter table profiles disable row level security;
   alter table global_songs disable row level security;
   ```

3. Activez le **Realtime** : Allez dans `Database` -> `Replication` -> Cliquez sur `gamestates` -> Activez `Insert/Update/Delete`.

### 2. Configuration Google Auth (Pour sauvegarder les comptes)

1. **Supabase** : Allez dans `Authentication` > `Providers` > `Google`. Copiez l'URL "Callback URL".
2. **Google Cloud Console** : Créez un projet, allez dans `APIs & Services` > `Credentials` > `Create OAuth Client ID`.
   - Type: Web Application
   - Authorized redirect URIs: Collez l'URL de Supabase copiée juste avant.
3. **Supabase** : Collez le `Client ID` et `Client Secret` fournis par Google et activez le provider.
4. **Supabase (URL Config)** : Allez dans `Authentication` > `URL Configuration`.
   - Site URL: `http://localhost:3000`
   - Redirect URLs: Ajoutez `http://localhost:3000/**` (et votre URL de prod plus tard).

### 3. Lancement

Créez un fichier `.env.local` à la racine :

```bash
NEXT_PUBLIC_SUPABASE_URL=VOTRE_URL_SUPABASE
NEXT_PUBLIC_SUPABASE_ANON_KEY=VOTRE_CLE_ANON
```

```bash
# Installez les dépendances
npm install

# Lancez le serveur (accessible sur votre réseau wifi)
npm run dev
```

Accédez ensuite à `http://localhost:3000` (ou votre IP locale depuis un mobile).
