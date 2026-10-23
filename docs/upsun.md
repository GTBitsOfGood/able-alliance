# Upsun

Upsun is the hosting provider for `paratransit.pts.gatech.edu`.

## Configuration

- It is a **fixed** project, not flex
- YAML for applications, routes, and services in `.platform/`
- Next.js and Socket.IO share one HTTP server in the `app` container, started with `npm run start:upsun` using `tsx`
- The app and PostgreSQL use size `S`, totaling 0.65 CPU on the Fixed plan
- For environment variables, use `npm run upsun:env -- .env.upsun` to sync every variable in the file, or append variable names to sync only those (you must have the `upsun` CLI installed)

  ```sh
  npm run upsun:env -- .env.upsun NEXT_PUBLIC_WS_URL WEBSOCKET_INTERNAL_SECRET
  ```

  Upsun CLI options can be passed after a second `--`, for example:
  `npm run upsun:env -- .env.upsun NEXT_PUBLIC_WS_URL -- --project <project>`.
