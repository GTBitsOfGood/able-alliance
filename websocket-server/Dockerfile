FROM node:24-slim

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
