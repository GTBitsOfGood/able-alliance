# Upsun

Upsun is the hosting provider for `gatech.edu` websites.

Our current domain is `paratransit.pts.gatech.edu`.

## Configuration

- YAML for applications, routes, and services in `.platform/`
- Next.js and Socket.IO share one HTTP server in the `app` container, started with `npm run start:upsun` using `tsx`
- The app and MongoDB use size `S`, totaling 0.65 CPU on the Fixed plan
- For environment variables, use `npm run upsun:env -- .env.upsun` to sync every variable in the file, or append variable names to sync only those (you must have the `upsun` CLI installed)

  ```sh
  npm run upsun:env -- .env.upsun NEXT_PUBLIC_WS_URL WEBSOCKET_INTERNAL_SECRET
  ```

  Upsun CLI options can be passed after a second `--`, for example:
  `npm run upsun:env -- .env.upsun NEXT_PUBLIC_WS_URL -- --project <project>`.

## Caveats

- We only have access to a `mongodb:4.0` service, so we have to pin Mongoose to `8.15.2` to be compatible
- It is a **fixed** project, not flex
