FROM node:24-slim

RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY websocket-server/package.json websocket-server/package-lock.json ./
RUN npm ci

COPY websocket-server ./websocket-server
COPY db ./db
RUN npx prisma generate --schema db/schema.prisma

RUN npm --prefix websocket-server run build && npm prune --omit=dev

WORKDIR /app/websocket-server

ENV PORT=4000

EXPOSE 4000

CMD ["npm", "start"]
