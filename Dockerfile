FROM node:18-alpine

WORKDIR /app

# Installer les dépendances
RUN npm install

# Copier le reste du code
COPY . .

# Construire l'application
RUN npm run build

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]
