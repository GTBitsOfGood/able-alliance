# Upsun

Upsun is the hosting provider for `gatech.edu` websites.

## Configuration

- YAML for applications, routes, and services in `.platform/`
- Next.js and Socket.IO share one HTTP server in the `app` container, started with `npm run start:upsun` using `tsx`
- The app and MongoDB use size `S`, totaling 0.65 CPU on the Fixed plan
- For environment variables, use the `npm run upsun:env` script to sync it (you must have `upsun` CLI installed)

## Caveats

- We only have access to a `mongodb:4.0` service, so we have to pin Mongoose to `8.15.2` to be compatible
- It is a **fixed** project, not flex
