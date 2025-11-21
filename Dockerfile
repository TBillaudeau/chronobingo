# Étape 1 : construire l'application
FROM node:18-alpine AS builder

WORKDIR /app

# Copier package.json et package-lock.json (si tu en as)
COPY package.json package-lock.json* ./

# Installer les dépendances
RUN npm ci

# Copier tout le reste du projet
COPY . .

# Builder l'app Next.js
RUN npm run build

# Étape 2 : lancer l'application
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copier les node_modules du builder
COPY --from=builder /app/node_modules ./node_modules

# Copier le build et les fichiers nécessaires
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# Exposer le port (par défaut Next.js écoute sur 3000)
EXPOSE 3000

# Commande pour démarrer le serveur Next.js
CMD ["npm", "start"]
