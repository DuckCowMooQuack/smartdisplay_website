from datetime import datetime
from pathlib import Path
import os
import random

import requests
from dotenv import load_dotenv
from flask import Flask, abort, render_template, send_from_directory, url_for

app = Flask(__name__)
load_dotenv()

APP_ROOT = Path(__file__).resolve().parent
STATIC_DIR = APP_ROOT / "static"
DEFAULT_IMAGE_DIR = STATIC_DIR / "images"
SUPPORTED_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")


def env_int(name, default):
    value = os.getenv(name, str(default))
    try:
        return int(value)
    except ValueError:
        app.logger.warning("Invalid integer for %s=%r, using %s", name, value, default)
        return default


OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "").strip()
ZIP_CODE = os.getenv("OPENWEATHER_ZIP_CODE", "68164").strip()
COUNTRY_CODE = os.getenv("OPENWEATHER_COUNTRY_CODE", "us").strip()
WEATHER_UNITS = os.getenv("OPENWEATHER_UNITS", "imperial").strip() or "imperial"
WEATHER_TIMEOUT_SECONDS = env_int("OPENWEATHER_TIMEOUT_SECONDS", 10)

IMAGE_DIR = Path(
    os.getenv(
        "SMARTDISPLAY_IMAGE_DIR",
        str(DEFAULT_IMAGE_DIR),
    )
).expanduser()
REFRESH_SECONDS = env_int("SMARTDISPLAY_REFRESH_SECONDS", 60)
HOST = os.getenv("SMARTDISPLAY_HOST", "0.0.0.0")
PORT = env_int("SMARTDISPLAY_PORT", 5000)

if WEATHER_UNITS == "metric":
    TEMP_UNIT = "C"
elif WEATHER_UNITS == "imperial":
    TEMP_UNIT = "F"
else:
    TEMP_UNIT = "K"


def get_weather():
    if not OPENWEATHER_API_KEY:
        app.logger.warning("OPENWEATHER_API_KEY is not set, using fallback weather values")
        return "--", "Weather unavailable"

    params = {
        "zip": f"{ZIP_CODE},{COUNTRY_CODE}",
        "appid": OPENWEATHER_API_KEY,
        "units": WEATHER_UNITS,
    }

    try:
        response = requests.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params=params,
            timeout=WEATHER_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
        temp = int(round(float(data["main"]["temp"])))
        description = data["weather"][0]["main"]
        return temp, description
    except Exception as exc:
        app.logger.warning("Weather lookup failed: %s", exc)
        return "--", "Weather unavailable"


def get_random_image_name():
    if not IMAGE_DIR.is_dir():
        app.logger.warning("Image directory does not exist: %s", IMAGE_DIR)
        return None

    images = [
        image.name
        for image in IMAGE_DIR.iterdir()
        if image.is_file() and image.suffix.lower() in SUPPORTED_IMAGE_EXTENSIONS
    ]
    if not images:
        app.logger.warning("No images found in %s", IMAGE_DIR)
        return None
    return random.choice(images)


def build_image_url(image_name):
    image_path = IMAGE_DIR / image_name
    if not image_path.exists():
        return None

    try:
        relative_path = image_path.resolve().relative_to(STATIC_DIR.resolve())
        return url_for("static", filename=str(relative_path).replace(os.sep, "/"))
    except ValueError:
        return url_for("serve_external_image", filename=image_name)


@app.route("/images/<path:filename>")
def serve_external_image(filename):
    if not IMAGE_DIR.is_dir():
        abort(404)
    return send_from_directory(IMAGE_DIR, filename)


@app.route("/favicon.ico")
def favicon():
    return "", 204

@app.route('/')
def index():
    temp, description = get_weather()
    image_name = get_random_image_name()
    image_url = build_image_url(image_name) if image_name else None
    formatted_date = datetime.now().strftime("%A, %B %d, %Y")
    return render_template(
        "index.html",
        temp=temp,
        description=description,
        temp_unit=TEMP_UNIT,
        formatted_date=formatted_date,
        image_name=image_name,
        image_url=image_url,
        refresh_seconds=REFRESH_SECONDS,
    )

if __name__ == '__main__':
    app.run(host=HOST, port=PORT)
