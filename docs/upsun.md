# Upsun

Upsun is the hosting provider for `gatech.edu` websites.

## Configuration

- YAML for applications, routes, and services in `.platform/`
- For environment variables, use the `npm run upsun:env` script to sync it (you must have `upsun` CLI installed)

## Caveats

- We only have access to a `mongodb:4.0` service, so we have to pin Mongoose to `8.15.2` to be compatible
- It is a **fixed** project, not flex
