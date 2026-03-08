FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
RUN npm ci

COPY . .

ENV PORT=4000

EXPOSE 4000

CMD ["node", "websocket-server/index.mjs"]