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
