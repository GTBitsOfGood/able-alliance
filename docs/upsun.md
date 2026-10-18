# Upsun

Upsun is the hosting provider for `gatech.edu` websites.

Our current domain is `paratransit.pts.gatech.edu`.

## Configuration

- It is a **fixed** project, not flex
- YAML for applications, routes, and services in `.platform/`
- Next.js and Socket.IO share one HTTP server in the `app` container, started with `npm run start:upsun` using `tsx`
- The app and MongoDB use size `S`, totaling 0.65 CPU on the Fixed plan
- For environment variables, use `npm run upsun:env -- .env.upsun` to sync every variable in the file, or append variable names to sync only those (you must have the `upsun` CLI installed)

  ```sh
  npm run upsun:env -- .env.upsun NEXT_PUBLIC_WS_URL WEBSOCKET_INTERNAL_SECRET
  ```

  Upsun CLI options can be passed after a second `--`, for example:
  `npm run upsun:env -- .env.upsun NEXT_PUBLIC_WS_URL -- --project <project>`.

## Database

- We only have access to a `mongodb:4.0` service, so we have to pin Mongoose to `8.15.2` to be compatible
- To connect to the database using MongoDB Compass, you have to use version `1.29.5` to be compatible with the older version
- When connecting Compass through an Upsun tunnel, explicitly set `authSource=main`: `mongodb://username:password@ip:port/main?authSource=main&directConnection=true`.
