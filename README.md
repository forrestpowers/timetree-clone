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

## Deploy (Dockhand, Caddy, Cloudflare Tunnel)

`docker-compose.yml` is one self-contained stack: the app plus Caddy, with the Caddyfile inline and named volumes, so it can be pasted straight into Dockhand. Only Caddy's port 80 is published. Every push to `main` builds `ghcr.io/forrestpowers/timetree-clone:latest` (see `.github/workflows/image.yml`).

One-time setup:

1. **Registry login.** The image is private. On GitHub, create a classic personal access token with only the `read:packages` scope. In Dockhand, add a registry: `ghcr.io`, your GitHub username, and that token.
2. **Stack.** In Dockhand, create a stack named `calendar` and paste in `docker-compose.yml`.
3. **Environment variables** on the stack:
   - `APP_ORIGIN` (required): your public URL, e.g. `https://cal.example.com`. Passkeys and email links depend on it.
   - Optional: `APP_NAME`, `SIGNUP_MODE`, `SMTP_URL`, `MAIL_FROM` (see the table below).
4. **Deploy** the stack.
5. **Tunnel.** Point your cloudflared public hostname at `http://<LXC IP>:80`.
6. Open the site and create the first account. It becomes the founding user.

To update: push to `main`, wait for the Image workflow to finish, then pull and redeploy the stack in Dockhand.

Without Dockhand: `APP_ORIGIN=https://cal.example.com docker compose up -d` (add `--build` to build the image locally).

Settings the container already includes:

- `BODY_SIZE_LIMIT=12M`, for photo and file uploads.
- `ADDRESS_HEADER=cf-connecting-ip`, so login rate limiting sees real client IPs.

Cloudflare dashboard settings:

- Turn **Rocket Loader** off.
- If you use Cloudflare Access or Bot Fight Mode, exempt `/feeds/*` (calendar feeds arrive in a later phase).

Private files are served with `Cache-Control: private`, so Cloudflare never caches them.

**Back up the `app_data` volume.** It holds the database (`app.db`) and every uploaded file. It lives under `/var/lib/docker/volumes/` on the LXC, so Proxmox backups of the container include it.

## Environment variables

| Variable      | Default                      | Purpose                                                      |
| ------------- | ---------------------------- | ------------------------------------------------------------ |
| `APP_ORIGIN`  | `http://localhost:5173`      | Public URL. Used for email links, invite links and passkeys. |
| `APP_NAME`    | `Calendar`                   | Name in the UI and on the home screen                        |
| `DATA_DIR`    | `./data` (`/data` in Docker) | Database and uploads                                         |
| `SIGNUP_MODE` | `invite`                     | `invite` or `open`                                           |
| `SMTP_URL`    | —                            | e.g. `smtps://user:pass@smtp.example.com:465`                |
| `MAIL_FROM`   | —                            | Sender address                                               |
