FROM node:24-slim

WORKDIR /app

COPY websocket-server/package.json websocket-server/package-lock.json ./
COPY websocket-server/tsconfig.json ./
RUN npm install

COPY websocket-server ./

RUN npm run build && npm prune --omit=dev

ENV PORT=4000

EXPOSE 4000

CMD ["node", "dist/server.js"]
