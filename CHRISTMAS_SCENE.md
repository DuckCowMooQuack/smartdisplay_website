# ASCII winter night

Open `/scenes/christmas` for a continuous preview of the snowy pine forest and
campfire. All scenery uses ASCII glyphs rendered on a canvas. Snow, fire, embers,
and tree lights animate at 15 fps without downloading assets. Tap for Pause or
Photos. The scene fits portrait and landscape displays and honors reduced motion.

The normal `/` photo page polls `/api/scene` once per second. Home Assistant can
trigger a full-screen overlay without needing to control or navigate the kiosk.
Photo refresh pauses for the scene and resumes afterward. Reloading the photo page
resumes any active scene for its remaining duration; restarting the Python service
clears active playback. Playback state is held by the single service process.

Configure `SMARTDISPLAY_SCENE_TOKEN` in the Pi's private `.env`, restart
`smartdisplay.service`, and use the same token in HA's private secrets:

```yaml
smartdisplay_scene_authorization: "Bearer YOUR_SHARED_TOKEN"
```

The connected HA repo tracks the REST commands in
`packages/smartdisplay_christmas.yaml` and the updated **Turn on Christmas lights**
automation. It starts the scene and the existing Alexa music request in parallel.
The duration is 241 seconds (4:01), matching the standard recording of Mariah
Carey's All I Want for Christmas Is You. Alexa startup latency may shift their
actual alignment slightly. Music continues to be handled by Alexa.

API:

- `GET /api/scene`: public playback status, with server time to avoid kiosk clock skew.
- `POST /api/scene`: `Authorization: Bearer TOKEN`, JSON
  `{"scene":"christmas","duration":241}`. Duration must be 1–3600 seconds.
- Stop early with `{"scene":"off"}`. Each play request starts a new playback.
- Empty configured tokens disable write access. Tokens are never sent to the browser.

Deployment files: `smartdisplay.py`, `templates/index.html`,
`templates/christmas.html`, `static/christmas.js`, `static/scene-player.js`.
Back up the Pi's app and `.env` before copying. Existing dependencies suffice.
Restart the service, then refresh the kiosk once to load the polling script.
The old photo page also refreshes itself at the existing configured interval.

Run API checks with `python3 -m unittest discover -s tests -v` using the app's
installed dependencies. Browser checks should cover portrait/landscape, motion,
pause, trigger, replay, expiry, dismissal, and photo refresh suppression.
