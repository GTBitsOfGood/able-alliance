FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
RUN npm install

COPY . .

RUN npm run build ; npm prune --omit=dev

EXPOSE 8443

CMD ["node", "dist/server.js"]
