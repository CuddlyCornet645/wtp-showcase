# Basis-Image
FROM node:20-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

# package.json & package-lock.json kopieren
COPY package*.json ./
COPY server.js ./

# Dependencies installieren
RUN npm install

# Restlichen Code kopieren
COPY public ./public

# Port freigeben (z.B. 3000)
EXPOSE 3000

# Startbefehl
CMD ["npm", "start"]