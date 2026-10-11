# Upsun

Upsun is the hosting provider for `gatech.edu` websites.

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

- To provision a user in the configured MongoDB database, run:

  ```sh
  npm run create-user -- --type Student --username jdoe3 --first-name Jane --last-name Doe --email jdoe3@gatech.edu
  ```

  Pass `--mongo-uri <uri>` to target a specific database; otherwise the script
  uses `MONGODB_URI` from the environment.

  Supported types are `Student`, `Driver`, `Admin`, and `SuperAdmin`. Student
  and driver records start with empty student information or shifts. The script
  validates the details and refuses duplicate usernames or email addresses.

## Caveats

- We only have access to a `mongodb:4.0` service, so we have to pin Mongoose to `8.15.2` to be compatible
- It is a **fixed** project, not flex
