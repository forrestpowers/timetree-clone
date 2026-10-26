# Calendar (TimeTree replacement)

A self-hosted shared family calendar, built as a mobile-first web app you can add to your iPhone home screen. It replaces the TimeTree iOS app. See [FEATURES.md](FEATURES.md) for the full feature spec and [PLAN.md](PLAN.md) for the build phases.

**Status: Phase 1 (foundation).** Accounts and passkeys, calendars, members, virtual members, invite links and QR codes, labels, events, month view with day list, settings, and an installable shell.

## Stack

SvelteKit 3 (Node adapter) · TypeScript · Tailwind 4 · SQLite through Node's built-in `node:sqlite` with Drizzle ORM (1.0 RC) · SimpleWebAuthn for passkeys · nodemailer.

## Develop

```bash
npm install
npm run dev
```

The first account created becomes the founding user. After that, sign-up only works through a calendar invite link (set `SIGNUP_MODE=open` to change that). Without `SMTP_URL`, emails such as verification and password reset are printed to the server log.

Useful scripts:

- `npm run check`: type check
- `npm test`: unit tests
- `npm run db:generate -- --name <change>`: create a migration after editing `src/lib/server/db/schema.ts` (migrations run automatically when the app starts)
- `python3 scripts/make-icons.py`: regenerate the app icons

## Deploy (Oracle Cloud, Dockhand, Pangolin)

The app runs on the same VM as Pangolin. `docker-compose.yml` is a self-contained Dockhand stack: it joins Pangolin's `pangolin_frontend` Docker network as `calendar-app` and publishes no ports. Every push to `main` builds the public image `ghcr.io/forrestpowers/timetree-clone:latest` for amd64 and arm64 (see `.github/workflows/image.yml`), so no registry login is needed.

One-time setup:

1. **Network.** Check that Pangolin's stack created the `pangolin_frontend` network (Dockhand's networks list, or `docker network ls`) and that Traefik or Gerbil is attached to it. If your network has another name, change it in `docker-compose.yml`.
2. **Stack.** In Dockhand, create a stack named `calendar`, paste in `docker-compose.yml`, and set its environment variables:
   - `APP_ORIGIN` (required): your public URL, e.g. `https://cal.example.com`. Passkeys and email links depend on it.
   - Optional: `APP_NAME`, `SIGNUP_MODE`, `SMTP_URL`, `MAIL_FROM` (see the table below).
3. **Deploy** the stack.
4. **Pangolin resource.** In the Pangolin dashboard:
   - Add an HTTP resource for your subdomain (e.g. `cal`) on the local site. If you don't have a local site yet, add one under Sites with the type _Local_.
   - Add a target: method `http`, host `calendar-app`, port `3000`.
   - Under Authentication, turn off platform SSO. The app has its own login, and calendar feed fetchers (Phase 6) can't pass Pangolin's.
5. Open the site and create the first account. It becomes the founding user.

To update: push to `main`, wait for the Image workflow to finish, then pull and redeploy the stack in Dockhand.

Without Dockhand: `APP_ORIGIN=https://cal.example.com docker compose up -d`. To use a locally built image instead, run `docker build -t ghcr.io/forrestpowers/timetree-clone:latest .` first.

Settings the container already includes:

- `BODY_SIZE_LIMIT=12M`, for photo and file uploads.
- `ADDRESS_HEADER=x-forwarded-for` and `XFF_DEPTH=1`, so login rate limiting sees the client IP that Pangolin's Traefik recorded.

**Back up the `app_data` volume.** It holds the database (`app.db`) and every uploaded file. On the VM it's under `/var/lib/docker/volumes/calendar_app_data/_data` (the prefix is the stack name).

## Environment variables

| Variable      | Default                      | Purpose                                                      |
| ------------- | ---------------------------- | ------------------------------------------------------------ |
| `APP_ORIGIN`  | `http://localhost:5173`      | Public URL. Used for email links, invite links and passkeys. |
| `APP_NAME`    | `Calendar`                   | Name in the UI and on the home screen                        |
| `DATA_DIR`    | `./data` (`/data` in Docker) | Database and uploads                                         |
| `SIGNUP_MODE` | `invite`                     | `invite` or `open`                                           |
| `SMTP_URL`    | —                            | e.g. `smtps://user:pass@smtp.example.com:465`                |
| `MAIL_FROM`   | —                            | Sender address                                               |
