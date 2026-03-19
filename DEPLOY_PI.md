# Smart Display Deployment (Raspberry Pi Buster)

## 1. Copy files to the Pi

Copy this project to:

`/home/pi/smartdisplay_website`

## 2. Install Python dependencies

```bash
cd /home/pi/smartdisplay_website
python3 -m pip install --user -r requirements.txt
```

## 3. Configure environment

```bash
cd /home/pi/smartdisplay_website
cp .env.example .env
```

Edit `.env` and set:

- `OPENWEATHER_API_KEY`
- `SMARTDISPLAY_IMAGE_DIR` (for example `/home/pi/mnt/gdrive/smartdisplay_data/images/keep`)
- `OPENWEATHER_REFRESH_SECONDS` (for example `900` for 15-minute weather updates)
- `SMARTDISPLAY_LAYOUT_MODE` (`single`)
- `SMARTDISPLAY_TRANSITION_MODE` (`none`, `postcard_drop`, or `postcard_drop_topdown`)
- `SMARTDISPLAY_AGENDA_ENABLED=1`
- `GOOGLE_CALENDAR_AUTH_MODE` (`service_account` for private calendars, `api_key` for public calendars)
- `GOOGLE_CALENDAR_API_KEY` (required only for `api_key` mode)
- `GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE` (required for `service_account` mode)
- `GOOGLE_CALENDAR_EVENTS_ID` (Google Calendar ID for events)
- `GOOGLE_CALENDAR_REMINDERS_ID` (optional separate calendar ID for reminders)
- `GOOGLE_CALENDAR_REFRESH_SECONDS` (for example `300` for 5-minute agenda updates)

Optional upload + QR:

- `SMARTDISPLAY_UPLOAD_ENABLED=1`
- `SMARTDISPLAY_UPLOAD_TOKEN` (long random value used for `/upload` auth)
- `SMARTDISPLAY_PUBLIC_BASE_URL` (optional, for example `http://192.168.1.50:5000`)
- `SMARTDISPLAY_SHOW_UPLOAD_QR=1`
- `SMARTDISPLAY_MAX_UPLOAD_MB=20`

Private calendar setup (`service_account` mode):

1. In Google Cloud Console, create a service account and create a JSON key.
2. Copy the JSON file to the Pi outside the repo tree (for example `/home/pi/smartdisplay_secrets/google-service-account.json`).
3. In Google Calendar settings for each calendar, share with the service account `client_email` and grant "See all event details".
4. Set `GOOGLE_CALENDAR_AUTH_MODE=service_account` and `GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE` in `.env`.

Public calendar setup (`api_key` mode):
- Set `GOOGLE_CALENDAR_AUTH_MODE=api_key` and `GOOGLE_CALENDAR_API_KEY`.

## 4. Install/update systemd service

```bash
sudo cp /home/pi/smartdisplay_website/smartdisplay.service.example /etc/systemd/system/smartdisplay.service
sudo systemctl daemon-reload
sudo systemctl enable smartdisplay.service
sudo systemctl restart smartdisplay.service
```

## 5. Verify

```bash
sudo systemctl status smartdisplay.service
journalctl -u smartdisplay.service -n 100 --no-pager
```
