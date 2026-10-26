# Build plan

See [FEATURES.md](FEATURES.md) for the full feature list. Section numbers below refer to it.

## Stack

- SvelteKit (TypeScript) on Node, PWA (manifest, service worker, share target)
- SQLite via Drizzle ORM; uploads on a mounted volume
- Sessions with email+password (argon2) and passkeys (`@simplewebauthn`)
- Server-Sent Events for live updates; `web-push` with VAPID keys; in-process scheduler for alerts and digests
- `rrule` for recurrence, `date-holidays` for holidays, `ical.js` for ICS in/out
- SMTP (any provider) for verification and reset emails
- Optional: Anthropic API key enables the AI features (§15)
- Single Docker image plus `docker-compose.yml`

## Deployment: Pangolin → app (Oracle Cloud, Dockhand)

Path: visitor → Pangolin's Traefik (TLS) → `http://calendar-app:3000` over Pangolin's Docker network. Pangolin and the app run on the same Oracle Cloud VM. The app is a Dockhand stack from `docker-compose.yml` that joins the external `pangolin` network under the alias `calendar-app` and publishes no host ports. GitHub Actions builds the image for amd64 and arm64 (Oracle's free Ampere shapes) to `ghcr.io/forrestpowers/timetree-clone` on every push to `main`.

What the app has to handle:

- **Public URL**: set `APP_ORIGIN=https://cal.example.com`. Passkeys are tied to that exact hostname, and email and invite links use it. SvelteKit 3 builds the request origin from the Host header, which Traefik passes through unchanged.
- **Client IP**: `ADDRESS_HEADER=x-forwarded-for` with `XFF_DEPTH=1` (set in the Dockerfile) takes the address Traefik saw, for login rate limiting and the device list. The app is reachable only from Pangolin's network, so the header can't be spoofed by connecting directly. If a CDN proxy is ever put in front of Pangolin, raise `XFF_DEPTH` to skip it.
- **Live updates (SSE)**: Traefik streams `text/event-stream` responses without buffering. The server sends a heartbeat every 25 seconds so idle connections aren't dropped, and the client reconnects automatically. Stream responses carry `Cache-Control: no-cache, no-transform`.
- **Private files**: photos and attachments are served from `/files/<id>` with `Cache-Control: private`.
- **Upload size**: `BODY_SIZE_LIMIT=12M` (set in the Dockerfile). The Node adapter's default is only 512 KB.
- **Compression**: the Node adapter serves pre-compressed (gzip and brotli) static assets on its own.
- **Service worker**: browsers fetch the service worker script past the HTTP cache by default, so updates reach installed phones without special headers.

Pangolin resource settings:

- Target: the local site, `http` to `calendar-app` port `3000`.
- Turn off Pangolin's own authentication (platform SSO) for this resource. The app has its own login, and Apple and Google Calendar fetch ICS feeds (`/feeds/*`, Phase 6) from their own servers, which can't pass a Pangolin login. If you keep Pangolin auth, add a bypass rule for `/feeds/*` and expect the installed iPhone app to show Pangolin's login whenever its session expires.

## Phase 0: before anything else

Run the TimeTree export with raw JSON, once per calendar:
`timetree-exporter -c CODE -o timetree.ics --include-comments --include-images --raw-output-dir raw-timetree`

## Phase 1: foundation ✅ (branch `phase-1-foundation`)

Accounts and profiles (§1), calendars (§2), invitations, members and virtual members (§3), labels and palette (§4), event CRUD with time zones, location, alerts, attendees (§5 core fields), month view plus day list (§10), settings basics (§16), PWA shell and tabs (§17), Docker.

Notes from building it:

- SvelteKit 3 and Drizzle 1.0 RC (`node-sqlite` driver, so there's no native SQLite module).
- Alerts are stored per event. They're delivered in Phase 6.
- The Docker image hasn't been built yet because Docker Desktop wasn't running. The production Node build was tested directly.

## Phase 2: TimeTree import ✅

**More → Import from TimeTree** takes the per-calendar JSON files from the export (`timetree_cal_<id>.json`), shows a preview, and imports into a new or existing calendar.

What it brings over:

- Labels, mapped by TimeTree label id and then by color.
- Events and memos, with all-day/timed handling, time zones, location and coordinates, URL, note and reminders.
- Repeat rules and links between exceptions and their series.
- The original created and updated times.
- TimeTree users, each mapped to "me", a virtual member, or left out.

Behavior:

- Re-importing skips events already imported, matched by TimeTree UUID.
- Deleted events are skipped. Birthdays are skipped too, because the app generates them from profiles.
- The JSON export has no comments or images, so those can't be imported.

Verified against the real export (calendar 26406140): 2,561 events, 1,030 all-day, 700 reminder rows, 93 notes and 10 labels, all matching the source file. A re-import added 0. Timed events show the correct local time in Chicago and New York zones.

The export's other file, "Primary Calendar" (26406130), was deleted in TimeTree and contains no events.

## Phase 3: the rest of events ✅

What's built:

- **Repeating events:** daily, weekly with chosen weekdays, monthly by date or by "nth weekday", and yearly; any interval; ending never, on a date, or after N times.
  - Rules are stored as RRULE/EXDATE and expanded in wall-clock time, so a 9:00 event stays at 9:00 across daylight-saving changes.
  - Editing or deleting asks: this event only, this and future, or all.
  - "This only" excludes the occurrence (EXDATE) and saves it as a linked standalone event.
  - "This and future" ends the old series and starts a new one, keeping a COUNT correct across the split.
  - "All" shifts the whole series when you edit one occurrence's time.
- **To-do lists** on events. Anyone in the calendar can tick items, and the list shows who ticked each one.
- **Attachments:** pdf, images, txt, docx, pptx, xlsx, up to 10 MB each and 10 per event, free for everyone.
- **Pins:** pin all occurrences or just one. Pinned events go ahead of other single-day events on a busy day.
- **Day counter:** count down to an event or up from it. Reminder intervals are saved; they're delivered in Phase 6.
- **Copying:** to another calendar (label matched by color, you as attendee, to-do items unticked) or to up to 31 dates in the same calendar, keeping the local time.
- **Drag and drop** in month view: long-press an event, drop it on another day, then choose Move or Copy. Moving one occurrence of a repeating event detaches only that occurrence.
- **Quick-create:** long-press an empty day to see your most-used event shapes and add one with a tap. When you have no history yet, starter titles appear instead.
- **Double-booking warning** in the editor. Events of 24 hours or longer don't count.
- **Folded duplicates:** in All Calendars, identical events from different calendars show once, with a "+n" badge.
- **Sharing:** as text (now including the repeat rule and to-do list) and via a QR code that links to the event.
- **Birthdays:** members' and virtual members' birthdays appear yearly (each person once, even across calendars), with their age. Feb 29 birthdays fall on Feb 28 in other years. Each calendar has a setting to hide them.

Moved to Phase 6: "Remind members" needs push notifications.

## Phase 4: collaboration ✅

What's built:

- **Live updates:** every change is pushed to open pages over server-sent events (`/api/stream`), so calendars, chat, memos and the activity feed refresh on their own. The reverse proxy must not buffer that path; Pangolin's Traefik streams it as is.
- **Activity tab** with an unread badge. It lists changes across your calendars (or one calendar), groups new items at the top, and shows old and new dates when an event moves.
- **Comments** on events and memos, with up to 4 photos each. Authors can edit; authors and calendar owners can delete.
- **Likes and reactions:** a like (❤️) on events and memos shows in the activity feed. Eight emoji reactions work on events, comments and chat messages.
- **Calendar chat:** messages, shared event cards ("Discuss in calendar chat"), and cards summarising event and memo changes between messages. It has an unread divider and badge, and each message has a sheet with reactions, Copy, Save as memo and Delete.
- **Memos tab:** quick add, a "new" dot for others' changes, drag to reorder (the order is shared), to-do lists, attachments, comments and labels.
  - "Add to calendar" turns a memo into an event, keeping its notes, list and comments.
  - "Save as memo" turns an event back into a memo.
  - The calendar page shows the latest memos under the month grid.
- **Footprints:** opening a calendar shows who else looked at it in the last 12 hours, once per visit.

## Phase 5: views and search

Week, 2-week, list, daily sheet, vertical 1/3/7-day timeline, height modes, font size, week numbers, holidays, stickers (§10), search (§11).

## Phase 6: notifications and sync

Web push for alerts, Today's Events digest, per-calendar notification modes, activity/chat pushes, day-counter pushes, "remind members" nudges (§12); ICS subscribe overlay, .ics import, ICS export feeds, JSON backup and restore (§13).

## Phase 7: album and sharing

Album with photo↔event links and location stripping (§9); available-dates image, share card, label stats (§14).

## Phase 8: AI (only when a key is configured)

Image scan to events (including PWA share target), voice to events, AI checklists (§15).

## Phase 9: polish

Lunar/rokuyo display, memo templates, personal API tokens, i18n, Google/Apple sign-in if wanted.
