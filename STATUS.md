# Smart Display Status

Last updated: November 24, 2026

## Christmas Scenes

- `/scenes/christmas` previews an animated ASCII snowy pine forest and campfire.
- Four upbeat previews: `/scenes/snowman_party`, `/scenes/christmas_village`,
  `/scenes/dancing_trees`, and `/scenes/santa_sleigh`.
- Portrait composition sizes the forest from screen width and compensates for
  character-cell proportions, keeping trees and fire from looking stretched.
- The photo page polls `/api/scene` and displays requested scenes full-screen,
  suspending photo refresh until playback expires.
- HA randomly selects one of all five scenes per run, with equal chances.
  The campfire gets Nat King Cole (192 seconds); upbeat scenes get Mariah Carey
  (241 seconds). Photos resume automatically. Selection can repeat on later runs.
- The connected HA repo contains the parameterized REST commands and parallel
  scene/music actions in the existing Turn on Christmas lights automation.
- See `CHRISTMAS_SCENE.md` for API, token setup, deployment, and validation notes.

## Current State

- Local app runs successfully with `python3 smartdisplay.py`.
- `.env` loading is now explicit in app startup (`load_dotenv()`), so local and Pi env vars are applied.
- App is now resilient:
  - Missing weather API or weather request failures no longer crash page render.
  - Missing/empty image directory no longer crashes page render.
- Image source is configurable and supports:
  - `static/images` (default), or
  - external folder via `SMARTDISPLAY_IMAGE_DIR` (including paths with spaces when quoted in `.env`).

## Files Changed

- `smartdisplay.py`
- `templates/index.html`
- `templates/upload.html`
- `requirements.txt`
- `.env.example`
- `smartdisplay.service.example`
- `DEPLOY_PI.md`

## Important Behavior Changes

- Configuration is driven by env vars, not hardcoded values.
- Weather units displayed in template now track configured units (`F`, `C`, or `K`).
- Refresh interval is configurable via `SMARTDISPLAY_REFRESH_SECONDS`.
- Weather refresh interval is independently configurable via `OPENWEATHER_REFRESH_SECONDS`.
- Agenda strip can be enabled with `SMARTDISPLAY_AGENDA_ENABLED` and pulls upcoming entries from Google Calendar.
- Agenda refresh interval is independently configurable via `GOOGLE_CALENDAR_REFRESH_SECONDS`.
- Events and reminders can come from separate Google Calendar IDs (`GOOGLE_CALENDAR_EVENTS_ID` / `GOOGLE_CALENDAR_REMINDERS_ID`).
- Google Calendar auth now supports `service_account` mode for private calendars (recommended) and `api_key` mode for public calendars.
- Optional token-gated upload endpoint is available at `/upload` and can be surfaced via on-screen QR code.
- External image folders are served through `/images/<filename>` route.
- Layout and transition are configurable via `SMARTDISPLAY_LAYOUT_MODE` and `SMARTDISPLAY_TRANSITION_MODE`.
- `postcard_drop` transition animates each new photo as a floating/landing postcard.
- `postcard_drop_topdown` transition animates each photo as if dropped from above onto a flat surface.
- Drop transitions now keep a short photo stack (two underlays) and animate the new photo on top (from second refresh onward).
- Overlay text now auto-switches between light and dark themes based on background image brightness.
- Overlay and filename display styles are tuned for portrait orientation readability on the kiosk display.
- Mobile viewport behavior is now explicitly pinned (`initial-scale=1`, no user zoom) for consistent kiosk rendering.
- Background image rendering no longer uses `background-attachment: fixed` to avoid old Android zoom/render glitches.
- Filename label is intentionally low-visibility by default and becomes readable for 8 seconds when the screen is tapped.
- `/favicon.ico` is handled explicitly and returns HTTP 204 to avoid recurring 404 log noise.
- Top weather/date/time overlay now attempts to fit inside top blank (letterboxed) space above the rendered photo when available, and falls back to default top placement when no top blank exists.
- Temporary on-screen overlay debug readout was removed after validation.
- Bright-image washout was reduced by lowering the bright-theme veil intensity.
- Bottom-right controls now include a hidden/tap-revealed `ASCII Weather` button.
- `ASCII Weather` toggles between photo mode and a full-screen ASCII weather scene (based on current weather description) and remembers the chosen mode via browser localStorage.

## Local Test Result (Known Good)

- `.env` is being read correctly.
- API key and configured image directory load from `.env`.
- Page returns HTTP 200 in local Flask test client.

## Pi Deployment Next Steps

1. Sync code to Pi (safe patterns, no delete):
   - Single-file update (most common for UI tweaks):
     - `rsync -av --progress templates/index.html pi@raspberrypi:~/smartdisplay_website/templates/index.html`
   - Full project update while preserving Pi-local secrets:
     - `rsync -av --progress --exclude '.env' --exclude '*.json' /home/mmallard/smartdisplay_website_rewrite/ pi@raspberrypi:/home/pi/smartdisplay_website/`
2. Install deps on Pi:
   - `cd /home/pi/smartdisplay_website`
   - `python3 -m pip install --user -r requirements.txt`
3. Configure env:
   - `cp .env.example .env`
   - Set `OPENWEATHER_API_KEY`
   - Set `OPENWEATHER_REFRESH_SECONDS` (example: `900` for 15-minute weather updates)
   - Set `SMARTDISPLAY_IMAGE_DIR` (example: `/home/pi/mnt/gdrive/smartdisplay_data/images/keep`)
   - Set `SMARTDISPLAY_LAYOUT_MODE=single`
   - Set `SMARTDISPLAY_TRANSITION_MODE=postcard_drop_topdown` (or `postcard_drop` / `none`)
   - Set `SMARTDISPLAY_AGENDA_ENABLED=1`
   - Set `GOOGLE_CALENDAR_AUTH_MODE=service_account`
   - Set `GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE`
   - Set `GOOGLE_CALENDAR_EVENTS_ID` and optional `GOOGLE_CALENDAR_REMINDERS_ID`
   - Optional: set `SMARTDISPLAY_UPLOAD_ENABLED=1` and `SMARTDISPLAY_UPLOAD_TOKEN` to enable phone uploads by QR
4. Install/refresh service:
   - `sudo cp smartdisplay.service.example /etc/systemd/system/smartdisplay.service`
   - `sudo systemctl daemon-reload`
   - `sudo systemctl restart smartdisplay.service`
5. Verify:
   - `sudo systemctl status smartdisplay.service`
   - `journalctl -u smartdisplay.service -n 100 --no-pager`

## Notes for Future Sessions

- Ask to open `STATUS.md` first for project context before making new changes.
- If weather fails but app still loads, check Pi DNS/network connectivity.
- User confirmed ASCII weather toggle feature works and wants visual polish tweaks in the next session.
