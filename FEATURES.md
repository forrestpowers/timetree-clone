# TimeTree clone: feature spec

Source: TimeTree iOS 15.33.0 (decrypted IPA). Derived from 3,591 English UI strings, the Core Data model (V113, 25 entities), the API paths in the binaries, and the four app extensions. This spec describes behavior to reimplement; no TimeTree code, artwork, icons or branding is reused.

Target: self-hosted, mobile-first PWA for a family or small group. One Docker container, SQLite.

Legend: **[core]** must have · **[later]** planned in a later phase · **[web-adapted]** native feature reworked for the web · **[skip]** deliberately not cloned (see the end)

---

## 1. Accounts and profiles

- **[core]** Email + password sign-up, email verification, resend verification, log in, log out
- **[core]** Forgot password → reset email; change email (confirmation sent to the new address); change password (requires the current one)
- **[core]** Password rules: 8–64 characters, at least two of letters/numbers/symbols, strength meter, confirmation must match
- **[core]** "Log out of all devices" (revokes every session)
- **[core]** Delete account, with a reason picker
- **[core]** Passkeys (WebAuthn) as an alternative login *(default chosen; change if you like)*
- **[later]** Sign in with Google / Apple (TimeTree has both; both need OAuth app registration)
- **[core]** Global profile: name, photo, birthday plus a "display birthday" toggle, one-line status ("Current status")
- **[core]** **Per-calendar profile**: optionally use a different name and photo in a specific calendar ("Calendar profile"). Chosen when joining a calendar ("Select profile → New profile")
- **[core]** Calendar role attribute (Husband/Wife/Child/Grandparent/Boyfriend/Girlfriend/Other), used for display only
- **[core]** Profile card for another member: birthday countdown ("Days until birthday: N"), last accessed time, related calendars

## 2. Calendars

- **[core]** Multiple calendars per user. Each calendar has a name (with a character limit), a description, a cover image and a **purpose** (Family, Relationship, Friends, Work, Shift schedule, School events, Lesson, Group/club, Hobbies, Personal, Other)
- **[core]** Background per calendar: a color from the palette, a preset image or an uploaded image
- **[core]** Rearrange the calendar list (drag to reorder)
- **[core]** Leave a calendar; delete a calendar (with a destructive-action confirmation)
- **[core]** **All Calendars** view: a merged view of every calendar, with a per-calendar ON/OFF toggle that also drives the daily digest notification and widgets/feeds
- **[core]** **Filter bar**: quick chips for showing or hiding calendars, with rearrangeable order, a "show calendar name" toggle and a setting for how many rows show when expanded
- **[core]** Per-calendar display settings: show members' birthdays, default view mode
- **[core]** "Update calendar" (force resync)
- **[core]** Limits enforced server-side: max calendars, events, memos, members, virtual members, comments (configurable constants)

## 3. Members and invitations

- **[core]** Invite by link, valid until an expiry date shown in the UI. Copy the link, or use the Web Share API (replaces TimeTree's LINE/Kakao/WhatsApp/Messenger/Telegram/WeChat/BAND/X buttons)
- **[core]** Invite by **QR code**, with an expiry and "Save as image"
- **[core]** Join flow: preview the calendar (name, inviter, member count), choose a profile, join
- **[core]** Member list split into **Me / Members / Virtual members**; remove (kick) a member with confirmation; a removed member sees "You have been removed from X"
- **[core]** Prompt to fill in a profile before inviting or after joining
- **[core]** **Virtual members**: account-free members (presets Child, Pet, Car, Grandfather, Grandmother, Other) with a name, birthday plus a toggle, and status. Cars get a "delivery date". They can be event attendees. Deleting one removes them from all events.
- **[core]** **Footprints**: a toast showing who recently viewed the calendar ("Checked the calendar 5 minutes ago")

## 4. Labels (event colors)

- **[core]** Per-calendar labels: name, color, order. Events pick one label; the calendar remembers the last-used label.
- **[core]** Label management screen with color picker
- **[core]** Palette (26 named colors from the app; the names and hex values are plain data):
  `#00ACC1` Cyan · `#039BE5` Light Blue · `#1E88E5` Blue · `#212121` Midnight black · `#2ECC87` Emerald green · `#36393D` Midnight black · `#3949AB` Indigo · `#3DC2C8` Modern cyan · `#43A047` Green · `#47B2F7` Deep sky blue · `#5E35B1` Deep Purple · `#757575` Dark Gray · `#7CB342` Light Green · `#8E24AA` Purple · `#948078` Pastel brown · `#B38BDC` Soft violet · `#C0CA33` Lime · `#D81B60` Pink · `#E73B3B` Apple red · `#F35F8C` French rose · `#F4511E` Deep Orange · `#FB7F77` Coral pink · `#FB8C00` Orange · `#FDC02D` Bright orange · `#FDD835` Yellow · `#FFB300` Amber
- **[core]** Color picker has two sections: "TimeTree colors" (above) and "Material Design colors"

## 5. Events

Fields (from the `Event` entity): title, all-day, start/end plus **separate start and end time zones**, location name plus lat/lon, URL, note, label, attendees (members and virtual members), alerts, recurrences, attachments, checklist, day count, pinned state, category (event or memo), type (normal or birthday), parent/child for recurrence exceptions.

- **[core]** Create/edit/delete. Validation: title required, start ≤ end, length caps on title, note, location, URL and checklist items
- **[core]** Discard-changes confirmation when closing the editor
- **[core]** **Location**: search for places (web: OpenStreetMap Nominatim or a configurable geocoder), enter text directly, save as "My locations"; open in the default map app, choosing Apple Maps or Google Maps in settings
- **[core]** **Alerts**: presets for on time, 5/10/15/30 minutes, 1 hour, 1/2/3 days, 1/2/3 weeks and 1 month before, plus "on the day at time X" for all-day events and fully custom. Multiple alerts per event.
- **[core]** **Recurrence**: daily, weekly (with weekdays), monthly by date or by nth weekday (1st–5th or last), yearly; custom interval ("every N"); end by a date or after a number of occurrences; BYMONTH plus BYMONTHDAY combinations. Stored as RRULE/EXDATE text, the same as TimeTree, so imports are lossless.
- **[core]** Edit or delete a recurring event: **this event only / this and future / all**
- **[later]** Lunar-calendar recurrence (Chinese/Korean lunisolar), with lunar date labels on the calendar
- **[core]** **Attendees** ("Members"): pick members and virtual members; join or leave an event yourself
- **[core]** **Double-booking warning**: flag when a selected attendee is already in an overlapping event
- **[core]** **Checklist / to-do list** on an event: items with checkboxes, "x/y Completed", a collapsible completed section
- **[core]** **File attachments**: pdf, png, jpg, heic, gif, txt, docx, pptx, xlsx; max 10 MB each. A Premium feature in TimeTree, free for everyone here. TimeTree expires files after a year; here they don't expire, with an optional retention setting.
- **[core]** **Pin important events**: pinned events sort to the top of a crowded day cell. Pin this occurrence or all occurrences. Double-tap a date to edit pins. (Premium in TimeTree.)
- **[core]** **Day counter** on an event: countdown or count-up, with a reminder interval (daily, weekly, monthly, yearly, every 100 days) and presets (Travel, Wedding, Anniversary, Child's birthday, Test, Live show, Diet, Date…). Includes a "List of Day Counts" screen and notifications such as "Today is Day 100 since X" or "3 days to X".
- **[core]** **Copy** an event to another calendar; **copy to multiple dates** by multi-selecting days on a mini calendar
- **[core]** **Drag and drop** in month or week view to **move** or **copy** (choice on drop)
- **[core]** **Quick-create from history**: long-press a date to see recent or frequent event templates (title, label, times) and create one in a single tap. Starter presets: Date, Dentist, Day off, Part-time job, Lunch, Pickup. Includes an "Event autocomplete" toggle in settings.
- **[core]** **Post-save action menu**: create another, copy to another calendar, copy to multiple dates, discuss in chat, edit
- **[core]** **Share event**: as formatted text (title, date, location, URL, members, checklist) via the Web Share API, or as a QR code
- **[core]** **Remind members**: send a push nudge to all attendees or selected ones ("Recently reminded members")
- **[core]** **Convert event ↔ memo** ("Save as memo")
- **[core]** **Birthday events**: generated from members' and virtual members' profile birthdays when the calendar shows birthdays, with a 🎂 title. A "Whose birthday is it?" prompt (Child/Partner/Spouse/Other) converts a one-off birthday into a yearly repeating one.
- **[core]** **Folded duplicates**: identical events across calendars collapse into one row ("You have N similar events")
- **[later]** **Tentative events** (仮予定): placeholder events, shown in Japanese builds only
- **[core]** Event detail page shows created by, created/updated time (relative or absolute), likes, attendees, change history

## 6. Memos (formerly "Keep")

In TimeTree a memo is an event with `category = 2`: it has no date.

- **[core]** Create, edit and delete memos per calendar: title (max 50 characters in the quick field), note, label, checklist, attachments
- **[core]** Memo list with **drag reordering** within a calendar; in All Calendars, newest first
- **[core]** The first 10 memos preview **under the month calendar**
- **[core]** Unread state; "Mark all memos as read"
- **[core]** Convert a memo to an event by giving it a date
- **[core]** Copy a memo to another calendar
- **[later]** Memo templates (TimeTree ships a Japanese household-chores template)

## 7. Comments, reactions and activity

- **[core]** **Comment thread on each event**: text plus image attachments; edit, delete, resend after a failure; an "unread from here" divider; read markers
- **[core]** **System entries** in the thread: created, deleted, title/date/location/URL/note/label/attendee/reminder/checklist/attachment updated, converted between memo and event, photo linked to the event
- **[core]** **Change history** view for an event
- **[core]** **Like** an event
- **[core]** **Emoji reactions** on events and chat messages: a reaction palette, a per-message cap, a reaction list
- **[core]** **Activity feed** (calendar-wide): every change above as a feed item with the actor, grouped as "Changes from Today / Yesterday / date", with a "New" section, unread badges and "Mark all as read". For date changes it shows **previous vs new date**.

## 8. Calendar chat

- **[core]** One group chat per calendar, with an on/off setting (`enableChat`)
- **[core]** Text messages, emoji reactions, unread divider ("↓ New messages"), new-message toast
- **[core]** Message actions: copy, save as memo, share to another calendar, share to another app
- **[core]** **Update digests posted into chat**: "3 events updated" / "2 memos deleted" cards linking to the items
- **[core]** "Discuss in Calendar Chat" from an event, which posts a card for that event
- **[core]** Live updates (Server-Sent Events) and push notifications for messages

## 9. Album

- **[core]** Shared photo album per calendar: upload several photos at once with progress ("Uploading photos… 3/10"), view, save, share, multi-select delete
- **[core]** **Link photos to events**, and unlink them; events show "N photos linked", and the album entry shows "Event linked to this photo"
- **[core]** "Potential matching events" suggestion when linking, based on the photo's EXIF date
- **[core]** Per-calendar setting to **strip location data** from uploads
- **[core]** Album activity in the feed ("X added 5 photos to the album")
- **[later]** "On this day N years ago" memories
- **[web-adapted]** TimeTree's *Photo Suggest* scans your camera roll for photos taken during events. A web app can't read the photo library in the background, so this becomes a suggestion at upload time based on EXIF dates.

## 10. Calendar views

- **[core]** **Monthly**: up to N event bars per day plus a "+n" overflow; multi-day bars; label colors; holiday names; birthdays; stickers; memo preview below
- **[core]** Month **calendar height modes**: Default, 40/45/50/55/60%, Full size (the rest of the screen shows the selected day's list)
- **[core]** **Weekly** (1 week) and **2 weeks**
- **[core]** **List / Summary**: an agenda list, with "Mark all events as read"
- **[core]** **Daily**: a sheet with Morning/Afternoon/Evening/Night sections; swipe left or right between days, swipe down to close
- **[core]** **Vertical timeline**: 1 day, 3 days, 7 days, with all-day row and "N more" (Premium in TimeTree)
- **[core]** Return-to-today button; long-press the view tab to switch modes
- **[core]** Display settings: week starts on (Sun/Mon/Sat), week numbers, "Saturday in blue", month font size (Smallest to Largest), dark/light/system theme
- **[core]** **National holidays**: choose one or more countries (AT, AU, BE, BR, CA, CH, CN, DE, DK, FR, GB, HK, ID, IT, JP, KR, MY, NL, NO, RU, SE, SG, TH, TW, US) plus "annual events"; data from the `date-holidays` library
- **[later]** Rokuyo (Japanese six-day cycle) and lunar date display
- **[core]** **Stickers**: decorate a date or a birthday with a sticker that all calendar members see ("X decorated the calendar"). Here they will be emoji or SVG stickers rather than TimeTree's artwork.

## 11. Search

- **[core]** Keyword search across events and memos
- **[core]** Filter by **label** and by **attendee** ("Myself" shortcut)
- **[core]** Search history with "Delete search history"
- **[core]** "Display search results in calendar" (highlights matches in month view)

## 12. Notifications (web push + in-app)

- **[core]** Event alerts (from each event's alert list)
- **[core]** **Today's Events** daily digest at a chosen time ("You have 3 events today: • …"), with an option to notify even on days with no events, and a choice of which calendars it covers
- **[core]** Per-calendar notification settings: off / **all events** / **attending events only** / **once-a-day summary at time X**
- **[core]** Activity pushes: comments, reactions, likes, member updates, chat messages, reminders from members, gift-free birthday greetings
- **[core]** Day-counter notifications
- **[core]** "Your account is not verified" reminder
- **[web-adapted]** TimeTree's notification extension adds avatars and inline reply. Web push on iOS shows title and body only, with no action buttons, so "Reply" opens the thread instead.

## 13. External calendars, import and export

- **[web-adapted]** TimeTree reads the iPhone's Calendar app (EventKit) to *display* and *import* events. A web app can't, so the clone offers:
  - **Subscribe to ICS URLs** (Google/Apple/school/sports feeds) shown as read-only overlay calendars in the filter bar *(default chosen: this replaces Public Calendars)*
  - **Import an .ics file** into a calendar, mapping its categories to labels (TimeTree's `ImportCalendarLabel`)
- **[core]** **ICS export feed**: a secret per-user URL for each calendar, or for all of them, to subscribe to from Apple or Google Calendar
- **[core]** **Full backup export** (JSON plus attachments zip) and restore
- **[core]** **TimeTree importer**: loads the TimeTree-exporter raw JSON (events including memos and birthdays, labels, members, comments as activities, images)

## 14. Sharing as images

- **[core]** **Share available dates as an image**: tap free dates on a mini calendar, then generate a PNG to share
- **[later]** **Share card**: render a 2-week or 1-month calendar as a styled image, with a header image, background/text colors, displayed info and style options
- **[later]** **Label statistics**: a chart of events per label, shareable as an image

## 15. AI features *(default chosen: on when an Anthropic API key is configured)*

- **[later]** **Scan an image → events**: a photo or screenshot of a school schedule, shift table or planner becomes a batch of events to confirm. Includes "More events detected, scan more?" and cancel. Replaces TimeTree's image-scan share extension; the PWA registers as a **share target** for images.
- **[later]** **Voice → events**: dictate ("dentist tomorrow at 3pm"), up to 10 events at once, confirmed before saving. Uses the browser's speech recognition or uploaded audio.
- **[later]** **AI to-do list**: generate a checklist for an event (school sports day, moving house…), with regenerate and delete-with-reason
- **[later]** "Calendar about" questions (kids, working adults, free text) that give the AI context
- Implemented with Claude via the Anthropic API; the features are hidden when no key is set.

## 16. Settings

- **[core]** Appearance: theme, week start, week numbers, Saturday blue, month font size, event autocomplete
- **[core]** Language: English first, with the i18n structure in place. TimeTree ships 15 locales.
- **[core]** Time zone: follows the device, with a "Device time zone has changed" notice showing the offset from the event's original zone
- **[core]** Default map app
- **[core]** Holidays: countries, annual events
- **[core]** Notifications: app pushes, Today's Events, per-calendar settings
- **[core]** Account management, connected sessions/devices
- **[later]** Personal API tokens. This replaces TimeTree's "Connect apps" OAuth platform with scopes calendar/event/member/comment/user and read/write.

## 17. App shell and PWA

- **[core]** Installable PWA with home-screen icon and splash screen, offline read cache, optimistic writes with a "Saving failed, tap to retry" state (matches TimeTree's `syncStatus` per record)
- **[core]** Tabs: Calendar · Feed/Activity · Memo · Album · More, plus a floating **+** (Event / Memo / Invite / Scan image)
- **[core]** App shortcuts: Create event, Today's events, New activity (manifest `shortcuts`)
- **[web-adapted]** **Widgets**: iOS PWAs can't add home-screen or lock-screen widgets. The workaround is subscribing to the ICS feed in Apple Calendar, which brings Apple's own calendar widgets.

---

## Not cloned

| TimeTree feature | Why not |
|---|---|
| Ads, ad hiding/reporting, tracking consent (ATT), reward-video ads | It's your app |
| TimeTree Premium paywall | Its features (vertical view, pin events, file attachments) are free for everyone here |
| Rewards/points, offerwall, Gifts (e-gift purchases), Store | Commercial partner features |
| "Today" page (news, weather, horoscope, time sales, COVID stats), Tokubai flyers | Japan-only partner content |
| Event Discovery / trending / campaigns / hashtags | Depends on TimeTree's global user base |
| Public Calendars platform (publish, follow, likes, analytics, admin invites, paid widgets) | Replaced by ICS subscribe/export *(default chosen; can be revisited)* |
| Friends list and "Shared Events" | TimeTree itself discontinued Shared Events |
| Assistant | TimeTree itself discontinued it |
| Facebook / Kakao / LINE SDK integrations | Replaced by the Web Share API |
| NPS surveys, review prompts, "cheering", usage diagnosis, demographics, marketing banners, guided tours | Growth/marketing tooling |
| ToS / privacy / guideline consent gates, parental consent | Private family deployment |
| Zendesk inquiry forms, TimeTree Lab toggles | Not needed |

## Data model mapping (TimeTree Core Data → clone)

| TimeTree entity | Clone table(s) |
|---|---|
| Calendar, CalendarDisplayPreference | `calendars`, `calendar_settings` |
| CalendarUser | `calendar_members` (role, per-calendar profile, last_accessed_at) |
| CalendarVirtualUser | `virtual_members` |
| CalendarLabel | `labels` |
| Event (category 1/2, type 0/1) | `events` (kind: event/memo/birthday), `event_attendees`, `event_alerts`, `event_checklist_items`, `event_files`, `event_pins` |
| EventActivity | `activities` (comment, system change, like, reaction) |
| EventLocation | `saved_locations` |
| EventHistory | `event_templates` (quick-create history) |
| CalendarMediaContent | `album_photos`, `album_photo_events` |
| CalendarSticker, Sticker | `date_stickers` |
| FilterCalendarItem | `user_calendar_filters` (incl. ICS subscriptions) |
| ImportCalendarLabel | `ics_label_mappings` |
| Memorialday | computed from `date-holidays` |
| — (chat) | `chat_messages`, `chat_reactions`, `read_markers` |
| — (day counter) | `day_counters` |
| — (push, feeds) | `push_subscriptions`, `ics_tokens`, `sessions`, `passkeys` |
