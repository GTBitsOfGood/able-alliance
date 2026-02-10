# Able Alliance

## Overview

Able Alliance is a GT student organization that is dedicated to improving on-campus disability inclusion via access & resource sharing, community & social support, etc. This is a transporation management system built for them. Learn more about the organization at https://sites.gatech.edu/gtablealliance/.

## Deployment Preview

A deployment preview of the main branch from netlify is available [here](https://able-alliance.netlify.app/). Note that SSO login and websocket functionality may not work with the deployment preview, because those use alternate servers.

## Development Setup

- Install [Node.js 24](https://nodejs.org/en/download/)
- Install [MongoDB Community Server](https://www.mongodb.com/docs/manual/administration/install-community/) for a local MongoDB instance, or use [MongoDB Compass](https://www.mongodb.com/try/download/compass) to inspect the database.
- Install and enable [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) in VS Code (optional but recommended).
- Ensure a MongoDB instance is running locally. For example:
  ```sh
  docker run --name mongodb -d -p 27017:27017 mongo
  ```
- In the project root, run:
  ```sh
  npm ci
  ```
- Create a `.env` file in the project root with `MONGODB_URI`. Copy from `.env.example`:
  ```sh
  cp .env.example .env
  ```
  Then set `MONGODB_URI=mongodb://localhost:27017/able-alliance` (or your MongoDB connection string).
- Start the Next.js dev server:
  ```sh
  npm run dev
  ```
- Open http://localhost:3000/ in your browser.

## Run With Docker

1. Install [Docker](https://docs.docker.com/engine/install/).
2. From the project root, start the app and MongoDB with Docker Compose:
   ```sh
   docker compose up
   ```
   The app service receives `MONGODB_URI` from the Compose file (`mongodb://mongo:27017/able-alliance?replicaSet=rs0`). No extra env file is required for Docker.
3. To rebuild after changing dependencies, run:
   ```sh
   docker compose up --build
   ```
   The app has live-reloading for code changes when the project is mounted into the container.

Note: If you run Mongo via Docker Compose, avoid starting another MongoDB on `localhost:27017`; Compose will start Mongo inside the stack and expose it.

## Major Technologies

- [MongoDB](https://www.mongodb.com/)
- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
