# Able Alliance

Able Alliance is a GT student organization that is dedicated to improving on-campus disability inclusion via access & resource sharing, community & social support, etc. This is a transportation management system built for them. Learn more about the organization at https://sites.gatech.edu/gtablealliance/.

## Deployment

The application is deployed at https://paratransit.pts.gatech.edu.

See [docs/upsun.md](docs/upsun.md) for documentation on Georgia Tech hosting.
See [docs/cas-integration.md](docs/cas-integration.md) for information on integrating with GT SSO CAS.
For deployment previews and local development, we use `mock-cas-server`.

## Deployment Preview

A deployment preview of the main branch from Netlify is available at https://able-alliance.netlify.app/.

[![Netlify Status](https://api.netlify.com/api/v1/badges/85fa2c6e-6dac-463a-8467-1d6d02d37cb3/deploy-status)](https://app.netlify.com/projects/able-alliance/deploys)

## Technologies

- [PostgreSQL 18](https://www.postgresql.org/)
- [Prisma ORM 7](https://www.prisma.io/) for the database schema and queries
- [Next.js](https://nextjs.org)
- [React](https://react.dev)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com/) for accessible interface components
- [Express](https://expressjs.com/) for the websocket server
- [Socket.IO](https://socket.io/) for real-time ride updates and messaging
- [Mapbox](https://www.mapbox.com/) for maps and travel-time estimates
- [Auth.js](https://authjs.dev/) and Georgia Tech CAS for authentication

There are two server components:

1. Next.js handles the frontend and API routes.
2. The Express.js `websocket-server` handles persistent websocket connections.

The Prisma schema, shared connection, and generated client live in `db/`. Both servers import `db/index.ts`, and `npx prisma generate` writes the client to `db/generated/`.

On Upsun, both run together in the `app` container on one HTTP server. See [docs/upsun.md](docs/upsun.md) for deployment details.

## Environment Setup

Copy `.env.example` to `.env` and fill in your API keys:

```sh
cp .env.example .env
```

For host development, use `localhost` instead of Docker service names.

## Docker Setup

- Install [Docker](https://docs.docker.com/engine/install/).
- Development:
  ```sh
  docker compose up --build --watch
  ```
- Production:
  ```sh
  docker compose -f docker-compose-prod.yml up --build
  ```

To run PostgreSQL 18 by itself in Docker:

```sh
docker run --name able-postgres -d -p 5432:5432 \
  -e POSTGRES_USER=able -e POSTGRES_PASSWORD=able -e POSTGRES_DB=able_alliance \
  -v able-postgres-data:/var/lib/postgresql postgres:18
```

## Local Setup (without Docker)

- Install [Node.js 24](https://nodejs.org/en/download/).
- Install PostgreSQL 18 locally and ensure it is running.
- Update the service URLs in `.env` to use `localhost`
- Install dependencies for each server:
  ```sh
  npm ci
  npm ci --prefix websocket-server
  npm ci --prefix mock-cas-server
  ```
- Generate the Prisma client and apply committed migrations:
  ```sh
  npx prisma generate
  npx prisma migrate deploy
  ```
  From `websocket-server/`, generate the same shared client with `npx prisma generate --schema ../db/schema.prisma`.
- Start each server in a separate terminal:
  ```sh
  npm run dev
  ```
  ```sh
  npm run dev:server
  ```
  ```sh
  cd mock-cas-server && npm run dev
  ```
- Open http://localhost:3000/ in your browser.

## Database Setup

`DATABASE_URL` is required for migrations and the running servers. Client generation does not connect to a database. Migrations live in `db/migrations/`. Docker and Upsun app startup run `npx prisma migrate deploy` to apply committed migrations before starting the server.

After editing `db/schema.prisma`, create and apply a migration against your local development database, then regenerate the client:

```sh
npx prisma migrate dev --name describe_change
npx prisma generate
```

Commit the generated migration alongside the schema change. Run `migrate dev` deliberately during development; startup and CI only apply existing migrations with `migrate deploy`.

To seed the database, run:

```sh
npm run seed -- "postgresql://able:able@localhost:5432/able_alliance"
```

## DevSecOps & Tests

- There is a husky pre-commit hook to lint and style code to maintain consistency.
- We use Playwright for API and UI testing. Use a disposable database whose name contains `test` or `e2e`.
- GitHub Actions run linting, formatting, type checks, and Playwright end-to-end tests. Netlify provides the deployment preview.
