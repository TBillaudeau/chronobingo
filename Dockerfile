# Image de base
FROM node:18-alpine

# Dossier de travail
WORKDIR /app

# Copier uniquement ce qui est nécessaire pour installer
COPY package.json ./

# Installer les dépendances
RUN npm install

# Copier tout le projet
COPY . .

# Build de l’app Next.js
RUN npm run build

# Port exposé par Next
EXPOSE 3000

# Commande de démarrage
CMD ["npm", "start"]