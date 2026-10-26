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

## Deploy (Docker, Caddy, Cloudflare Tunnel)

`docker-compose.yml` runs the app and Caddy together; only Caddy's port 80 is published. A Debian LXC from the Proxmox community "Docker" script works well (2 cores, 2 GB RAM, 10–16 GB disk, static IP).

1. Clone the repository on the server.
2. Edit `docker-compose.yml`: set `APP_ORIGIN` to your public URL, and SMTP settings if you want real emails.
3. Create the data folder for the app's user (uid 1000): `mkdir -p data && chown 1000:1000 data`.
4. Run `docker compose up -d --build`.
5. Point your cloudflared tunnel's public hostname at `http://<server IP>:80`.

To update: `git pull && docker compose up -d --build`.

Settings the container already includes:

- `BODY_SIZE_LIMIT=12M`, for photo and file uploads.
- `ADDRESS_HEADER=cf-connecting-ip`, so login rate limiting sees real client IPs.

Cloudflare dashboard settings:

- Turn **Rocket Loader** off.
- If you use Cloudflare Access or Bot Fight Mode, exempt `/feeds/*` (calendar feeds arrive in a later phase).

Private files are served with `Cache-Control: private`, so Cloudflare never caches them.

**Back up the `data/` folder.** It holds the database (`app.db`) and every uploaded file.

## Environment variables

| Variable      | Default                      | Purpose                                                      |
| ------------- | ---------------------------- | ------------------------------------------------------------ |
| `APP_ORIGIN`  | `http://localhost:5173`      | Public URL. Used for email links, invite links and passkeys. |
| `APP_NAME`    | `Calendar`                   | Name in the UI and on the home screen                        |
| `DATA_DIR`    | `./data` (`/data` in Docker) | Database and uploads                                         |
| `SIGNUP_MODE` | `invite`                     | `invite` or `open`                                           |
| `SMTP_URL`    | —                            | e.g. `smtps://user:pass@smtp.example.com:465`                |
| `MAIL_FROM`   | —                            | Sender address                                               |
