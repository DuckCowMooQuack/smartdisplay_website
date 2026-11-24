# ASCII Christmas scenes

The daily **Turn on Christmas lights** automation randomly selects one of five
scenes. Each has an equal 20% chance on each run; repeats are possible. The scene
is selected once and its matching song and duration are used together:

| Scene ID | Preview | Alexa song | Duration |
| --- | --- | --- | --- |
| `christmas` | `/scenes/christmas` | The Christmas Song (Merry Christmas to You), Nat King Cole | 192 seconds (3:12) |
| `snowman_party` | `/scenes/snowman_party` | All I Want for Christmas Is You, Mariah Carey | 241 seconds (4:01) |
| `christmas_village` | `/scenes/christmas_village` | Mariah Carey | 241 seconds |
| `dancing_trees` | `/scenes/dancing_trees` | Mariah Carey | 241 seconds |
| `santa_sleigh` | `/scenes/santa_sleigh` | Mariah Carey | 241 seconds |

The four upbeat scenes use dancing snowmen, chasing village lights and a present
train, swaying trees and hopping gifts, or a flying sleigh over scrolling rooftops.
The quiet forest and campfire is preserved for Nat King Cole. Art uses ASCII glyphs
on a canvas at 15 fps, with no external assets or audio downloads. Character shapes
keep their physical proportions on portrait displays. Standalone previews play
continuously and include a scene picker; they do not start music or change HA.
Tap for Pause or Photos. Reduced-motion preferences are honored.

The normal `/` photo page polls `/api/scene` once per second. HA can trigger a
full-screen overlay without controlling the kiosk browser. Photo refresh pauses
until expiry, then resumes. Reloading the page resumes an active scene for its
remaining duration; restarting the Python service clears playback. State is held
by the single service process. The local expiry timer works if the network fails.

Configure `SMARTDISPLAY_SCENE_TOKEN` in the Pi's private `.env` and the same token
in HA's private secrets as `smartdisplay_scene_authorization: "Bearer TOKEN"`.
Do not commit either token. Empty Pi tokens disable write access; no credentials
are sent to the browser.

API:

- `GET /api/scene`: public status and server time, avoiding kiosk clock skew.
- `POST /api/scene`: bearer auth and JSON `{"scene":"snowman_party","duration":241}`.
  The scene must be one of the five IDs above; duration must be 1–3600 seconds.
- `{"scene":"off"}` stops playback. Each start creates a new playback ID.
- A start with no duration defaults to 241 seconds for backward compatibility;
  the HA automation always supplies the duration matching its selected song.

HA configuration lives in the connected ha_scripts_and_config repository:
`automations.yaml` and `packages/smartdisplay_christmas.yaml`. It preserves the
existing lights, sunset trigger, Alexa entity and everywhere group. Scene and
music actions start in parallel. A scene connection failure does not stop music.
Alexa startup latency and recording selection can vary, so this is a timed display
rather than synchronization with an observed playback position.

Deployment files: `smartdisplay.py`, `templates/index.html`,
`templates/christmas.html`, `static/christmas.js`, `static/festive.js`, and
`static/scene-player.js`. Back up the Pi app before copying; preserve `.env`.
Restart `smartdisplay.service` and let the kiosk photo page refresh once.
Scene and polling asset URLs carry a version to avoid stale cached scripts.
No new runtime dependencies are required.

Run API tests with `python3 -m unittest discover -s tests -v`. Browser checks cover
all five scenes at portrait/landscape sizes, motion, pause, switching, expiry,
photo refresh suppression, and dismissal. HA tests check every possible random
selection for the right song and payload. Run `ha core check` before applying HA
changes, then reload REST commands and automations; no new integration is needed.
