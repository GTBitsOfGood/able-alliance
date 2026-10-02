# Able Alliance

## Overview

Able Alliance is a GT student organization that is dedicated to improving on-campus disability inclusion via access & resource sharing, community & social support, etc. This is a transporation management system built for them. Learn more about the organization at https://sites.gatech.edu/gtablealliance/.

## Deployment Preview

A deployment preview of the main branch from netlify is available [here](https://able-alliance.netlify.app/).

[![Netlify Status](https://api.netlify.com/api/v1/badges/85fa2c6e-6dac-463a-8467-1d6d02d37cb3/deploy-status)](https://app.netlify.com/projects/able-alliance/deploys)

## Environment Setup

Copy `.env.example` to `.env` and fill in your API keys:

```sh
cp .env.example .env
```

For host development, use `localhost` instead of Docker service names.

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
- Start the Next.js dev server:
  ```sh
  npm run dev
  ```
- Open http://localhost:3000/ in your browser.

## Run With Docker

- Install [Docker](https://docs.docker.com/engine/install/).
- Development:
  ```sh
  docker compose up --build --watch
  ```
- Production:
  ```sh
  docker compose -f docker-compose-prod.yml up --build
  ```

### Seeding the Database

To seed the database with sample users, locations, vehicles, and routes, run:

```sh
npm run seed -- "mongodb://localhost:27017/able-alliance"
```

## Major Technologies

- [MongoDB](https://www.mongodb.com/)
- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
