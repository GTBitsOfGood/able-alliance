FROM node:24-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY tsconfig.json ./
RUN npm ci

COPY . .
# COPY ../src/server/db/models/RouteModel.ts ./src/server/db/models/
# RUN npm run build

ENV PORT=4000

EXPOSE 4000

CMD ["node", "websocket-server/index.mjs"]
# CMD ["npx", "tsx", "websocket-server/index.mjs"]