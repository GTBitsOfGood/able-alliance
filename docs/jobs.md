# Jobs

## Local

- Run `npm run cron:ride-series` to generate recurring rides 28 days ahead
- Uses the usual `.env` configuration; safe to rerun
- With Docker Compose: `docker compose exec app npm run cron:ride-series`

## Upsun

- Runs `npm run cron:ride-series` daily at 05:00 UTC
- Schedule is defined in `.platform/applications.yaml` under `crons.ride-series`
- Uses `WEBSOCKET_INTERNAL_URL` for real-time updates through the shared HTTPS server
