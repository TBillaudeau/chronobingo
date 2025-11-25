FROM node:18-alpine

WORKDIR /app

# Copier le reste du code
COPY . .

# Installer les dépendances
RUN npm install

# Construire l'application
RUN npm run build

# Exposer le port
EXPOSE 3000

# Démarrer l'application
CMD ["npm", "start"]
