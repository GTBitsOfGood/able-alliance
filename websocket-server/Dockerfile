FROM node:24-slim

WORKDIR /app

COPY websocket-server/package.json ./package.json
COPY websocket-server/package-lock.json ./package-lock.json
COPY websocket-server/tsconfig.json ./tsconfig.json
RUN npm ci

COPY websocket-server ./websocket-server
# COPY ../src/server/db/models/RouteModel.ts ./src/server/db/models/
COPY src/server/db/models/RouteModel.ts ./src/server/db/models/

RUN npm run build

ENV PORT=4000

EXPOSE 4000

CMD ["node", "websocket-server/index.mjs"]
