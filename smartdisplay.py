from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import base64
import io
import json
import os
import random
import secrets
import threading
import time
from urllib.parse import quote, urlencode, urlsplit

import qrcode
import requests
from dotenv import load_dotenv
from flask import Flask, abort, render_template, request, send_from_directory, url_for
from qrcode.image.svg import SvgPathImage
from werkzeug.utils import secure_filename
from uuid import uuid4

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


def env_choice(name, default, supported_values):
    value = os.getenv(name, default).strip().lower() or default
    if value not in supported_values:
        app.logger.warning(
            "Invalid value for %s=%r, using %s (allowed: %s)",
            name,
            value,
            default,
            ", ".join(sorted(supported_values)),
        )
        return default
    return value


def env_bool(name, default=False):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "").strip()
ZIP_CODE = os.getenv("OPENWEATHER_ZIP_CODE", "68164").strip()
COUNTRY_CODE = os.getenv("OPENWEATHER_COUNTRY_CODE", "us").strip()
WEATHER_UNITS = os.getenv("OPENWEATHER_UNITS", "imperial").strip() or "imperial"
WEATHER_TIMEOUT_SECONDS = env_int("OPENWEATHER_TIMEOUT_SECONDS", 10)
WEATHER_REFRESH_SECONDS = max(0, env_int("OPENWEATHER_REFRESH_SECONDS", 900))

GOOGLE_CALENDAR_API_KEY = os.getenv("GOOGLE_CALENDAR_API_KEY", "").strip()
GOOGLE_CALENDAR_AUTH_MODE = env_choice(
    "GOOGLE_CALENDAR_AUTH_MODE",
    "api_key",
    {"api_key", "service_account"},
)
GOOGLE_CALENDAR_EVENTS_ID = os.getenv("GOOGLE_CALENDAR_EVENTS_ID", "").strip()
GOOGLE_CALENDAR_REMINDERS_ID = os.getenv("GOOGLE_CALENDAR_REMINDERS_ID", "").strip()
GOOGLE_CALENDAR_EVENTS_LABEL = os.getenv("GOOGLE_CALENDAR_EVENTS_LABEL", "Event").strip() or "Event"
GOOGLE_CALENDAR_REMINDERS_LABEL = (
    os.getenv("GOOGLE_CALENDAR_REMINDERS_LABEL", "Reminder").strip() or "Reminder"
)
GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE = os.getenv("GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE", "").strip()
GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON", "").strip()
GOOGLE_CALENDAR_SERVICE_ACCOUNT_SUBJECT = (
    os.getenv("GOOGLE_CALENDAR_SERVICE_ACCOUNT_SUBJECT", "").strip()
)
GOOGLE_CALENDAR_TIMEOUT_SECONDS = env_int("GOOGLE_CALENDAR_TIMEOUT_SECONDS", 10)
GOOGLE_CALENDAR_REFRESH_SECONDS = max(0, env_int("GOOGLE_CALENDAR_REFRESH_SECONDS", 300))
GOOGLE_CALENDAR_LOOKAHEAD_DAYS = max(1, env_int("GOOGLE_CALENDAR_LOOKAHEAD_DAYS", 7))
GOOGLE_CALENDAR_MAX_ITEMS = max(1, env_int("GOOGLE_CALENDAR_MAX_ITEMS", 4))

IMAGE_DIR = Path(
    os.getenv(
        "SMARTDISPLAY_IMAGE_DIR",
        str(DEFAULT_IMAGE_DIR),
    )
).expanduser()
REFRESH_SECONDS = env_int("SMARTDISPLAY_REFRESH_SECONDS", 60)
LAYOUT_MODE = env_choice("SMARTDISPLAY_LAYOUT_MODE", "single", {"single"})
TRANSITION_MODE = env_choice(
    "SMARTDISPLAY_TRANSITION_MODE",
    "none",
    {"none", "postcard_drop", "postcard_drop_topdown"},
)
SMARTDISPLAY_AGENDA_ENABLED = env_bool("SMARTDISPLAY_AGENDA_ENABLED", True)
SMARTDISPLAY_UPLOAD_ENABLED = env_bool("SMARTDISPLAY_UPLOAD_ENABLED", False)
SMARTDISPLAY_UPLOAD_TOKEN = os.getenv("SMARTDISPLAY_UPLOAD_TOKEN", "").strip()
SMARTDISPLAY_PUBLIC_BASE_URL = os.getenv("SMARTDISPLAY_PUBLIC_BASE_URL", "").strip().rstrip("/")
SMARTDISPLAY_SHOW_UPLOAD_QR = env_bool("SMARTDISPLAY_SHOW_UPLOAD_QR", True)
SMARTDISPLAY_MAX_UPLOAD_MB = max(1, env_int("SMARTDISPLAY_MAX_UPLOAD_MB", 20))
HOST = os.getenv("SMARTDISPLAY_HOST", "0.0.0.0")
PORT = env_int("SMARTDISPLAY_PORT", 5000)
SMARTDISPLAY_SCENE_TOKEN = os.getenv("SMARTDISPLAY_SCENE_TOKEN", "").strip()

SCENE_LOCK = threading.Lock()
SCENE_STATE = {"scene": None, "started_at": None, "ends_at": None, "id": None}


def current_scene():
    with SCENE_LOCK:
        if SCENE_STATE["ends_at"] and time.time() >= SCENE_STATE["ends_at"]:
            SCENE_STATE.update(scene=None, started_at=None, ends_at=None, id=None)
        state = dict(SCENE_STATE)
        state["server_time"] = time.time()
        return state


@app.route("/api/scene", methods=["GET", "POST"])
def scene_control():
    if request.method == "GET":
        response = app.json.response(current_scene())
    else:
        if not SMARTDISPLAY_SCENE_TOKEN:
            return {"error": "Set SMARTDISPLAY_SCENE_TOKEN to enable scene control"}, 503
        authorization = request.headers.get("Authorization", "")
        if not secrets.compare_digest(authorization, "Bearer " + SMARTDISPLAY_SCENE_TOKEN):
            return {"error": "Unauthorized"}, 401
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or payload.get("scene") not in ("christmas", "off"):
            return {"error": "scene must be christmas or off"}, 400
        duration = payload.get("duration", 241)
        if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not 1 <= duration <= 3600:
            return {"error": "duration must be between 1 and 3600 seconds"}, 400
        now = time.time()
        with SCENE_LOCK:
            if payload["scene"] == "off":
                SCENE_STATE.update(scene=None, started_at=None, ends_at=None, id=None)
            else:
                SCENE_STATE.update(scene="christmas", started_at=now, ends_at=now + duration, id=uuid4().hex)
            state = dict(SCENE_STATE)
            state["server_time"] = now
        response = app.json.response(state)
    response.headers["Cache-Control"] = "no-store"
    return response


@app.route("/scenes/christmas")
def christmas_scene():
    return render_template("christmas.html")

MAX_UPLOAD_BYTES = SMARTDISPLAY_MAX_UPLOAD_MB * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES

if WEATHER_UNITS == "metric":
    TEMP_UNIT = "C"
elif WEATHER_UNITS == "imperial":
    TEMP_UNIT = "F"
else:
    TEMP_UNIT = "K"

LOCAL_TIMEZONE = datetime.now().astimezone().tzinfo or timezone.utc

WEATHER_CACHE_LOCK = threading.Lock()
WEATHER_CACHE = {
    "fetched_at": None,
    "temp": "--",
    "description": "Weather unavailable",
}

AGENDA_CACHE_LOCK = threading.Lock()
AGENDA_CACHE = {
    "fetched_at": None,
    "items": [],
}

GOOGLE_SESSION_LOCK = threading.Lock()
GOOGLE_SESSION_CACHE = {
    "cache_key": None,
    "session": None,
    "failed": False,
}

UPLOAD_QR_CACHE_LOCK = threading.Lock()
UPLOAD_QR_CACHE = {
    "url": None,
    "data_uri": None,
}


def get_any_cached_weather():
    with WEATHER_CACHE_LOCK:
        if WEATHER_CACHE["fetched_at"] is None:
            return None
        return WEATHER_CACHE["temp"], WEATHER_CACHE["description"]


def get_fresh_cached_weather(now):
    if WEATHER_REFRESH_SECONDS <= 0:
        return None

    with WEATHER_CACHE_LOCK:
        fetched_at = WEATHER_CACHE["fetched_at"]
        if fetched_at is None:
            return None
        if now - fetched_at >= WEATHER_REFRESH_SECONDS:
            return None
        return WEATHER_CACHE["temp"], WEATHER_CACHE["description"]


def set_weather_cache(temp, description, fetched_at):
    with WEATHER_CACHE_LOCK:
        WEATHER_CACHE["temp"] = temp
        WEATHER_CACHE["description"] = description
        WEATHER_CACHE["fetched_at"] = fetched_at


def get_weather():
    now = time.time()
    fresh_cached = get_fresh_cached_weather(now)
    if fresh_cached is not None:
        return fresh_cached

    if not OPENWEATHER_API_KEY:
        app.logger.warning("OPENWEATHER_API_KEY is not set, using fallback weather values")
        cached = get_any_cached_weather()
        if cached is not None:
            return cached
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
        set_weather_cache(temp, description, now)
        return temp, description
    except Exception as exc:
        app.logger.warning("Weather lookup failed: %s", exc)
        cached = get_any_cached_weather()
        if cached is not None:
            # Keep stale weather if lookup fails and retry later.
            set_weather_cache(cached[0], cached[1], now)
            return cached
        return "--", "Weather unavailable"


def parse_iso_datetime(value):
    if not value:
        return None
    normalized = value.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=LOCAL_TIMEZONE)
    return parsed


def parse_iso_date(value):
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError:
        return None


def format_clock(dt):
    if not dt:
        return ""
    return dt.strftime("%I:%M %p").lstrip("0")


def day_label(target_day, today):
    if target_day == today:
        return "Today"
    if target_day == today + timedelta(days=1):
        return "Tomorrow"
    return target_day.strftime("%a")


def shorten_text(value, max_length):
    if len(value) <= max_length:
        return value
    return value[: max_length - 3].rstrip() + "..."


def parse_google_event(item, source_kind, source_label):
    start_data = item.get("start") or {}
    end_data = item.get("end") or {}
    title = (item.get("summary") or "").strip() or "Untitled"

    if start_data.get("dateTime"):
        start_dt = parse_iso_datetime(start_data.get("dateTime"))
        if start_dt is None:
            return None

        end_dt = parse_iso_datetime(end_data.get("dateTime"))
        start_local = start_dt.astimezone(LOCAL_TIMEZONE)
        end_local = end_dt.astimezone(LOCAL_TIMEZONE) if end_dt is not None else None
        return {
            "title": title,
            "source_kind": source_kind,
            "source_label": source_label,
            "all_day": False,
            "start_date": start_local.date(),
            "end_date": None,
            "sort_dt": start_local,
            "start_dt": start_local,
            "end_dt": end_local,
        }

    if start_data.get("date"):
        start_day = parse_iso_date(start_data.get("date"))
        if start_day is None:
            return None
        end_day = parse_iso_date(end_data.get("date"))
        start_local = datetime.combine(start_day, datetime.min.time(), tzinfo=LOCAL_TIMEZONE)
        return {
            "title": title,
            "source_kind": source_kind,
            "source_label": source_label,
            "all_day": True,
            "start_date": start_day,
            "end_date": end_day,
            "sort_dt": start_local,
            "start_dt": start_local,
            "end_dt": None,
        }

    return None


def is_event_active_or_upcoming(event, now_local):
    if event["all_day"]:
        end_day = event["end_date"]
        if end_day is not None:
            return end_day > now_local.date()
        return event["start_date"] >= now_local.date()

    end_dt = event["end_dt"]
    if end_dt is None:
        end_dt = event["start_dt"] + timedelta(minutes=1)
    return end_dt > now_local


def format_agenda_item(event, today):
    title = shorten_text(event["title"], 64)
    if event["all_day"]:
        when_label = day_label(event["start_date"], today)
        if event["source_kind"] == "reminder":
            return f"{event['source_label']} ({when_label}): {title}"
        return f"{when_label}: {title}"

    when_label = format_clock(event["start_dt"])
    if event["source_kind"] == "reminder":
        return f"{event['source_label']} {when_label}: {title}"
    return f"{when_label} {title}"


def has_google_calendar_credentials():
    if GOOGLE_CALENDAR_AUTH_MODE == "service_account":
        return bool(GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE or GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON)
    return bool(GOOGLE_CALENDAR_API_KEY)


def get_service_account_file_fingerprint():
    if not GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE:
        return ""

    path = Path(GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE).expanduser()
    try:
        stat = path.stat()
        return f"{path}:{int(stat.st_mtime)}:{stat.st_size}"
    except OSError:
        return f"{path}:missing"


def get_google_service_session():
    cache_key = (
        GOOGLE_CALENDAR_AUTH_MODE,
        get_service_account_file_fingerprint(),
        GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON,
        GOOGLE_CALENDAR_SERVICE_ACCOUNT_SUBJECT,
    )

    with GOOGLE_SESSION_LOCK:
        if GOOGLE_SESSION_CACHE["cache_key"] == cache_key:
            if GOOGLE_SESSION_CACHE["session"] is not None:
                return GOOGLE_SESSION_CACHE["session"]
            if GOOGLE_SESSION_CACHE["failed"]:
                return None

    try:
        from google.auth.transport.requests import AuthorizedSession
        from google.oauth2 import service_account
    except ImportError:
        app.logger.warning(
            "google-auth is required for GOOGLE_CALENDAR_AUTH_MODE=service_account."
        )
        with GOOGLE_SESSION_LOCK:
            GOOGLE_SESSION_CACHE["cache_key"] = cache_key
            GOOGLE_SESSION_CACHE["session"] = None
            GOOGLE_SESSION_CACHE["failed"] = True
        return None

    credentials = None
    try:
        scopes = ["https://www.googleapis.com/auth/calendar.readonly"]
        if GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON:
            info = json.loads(GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON)
            credentials = service_account.Credentials.from_service_account_info(
                info, scopes=scopes
            )
        elif GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE:
            credentials = service_account.Credentials.from_service_account_file(
                str(Path(GOOGLE_CALENDAR_SERVICE_ACCOUNT_FILE).expanduser()),
                scopes=scopes,
            )

        if credentials is None:
            app.logger.warning(
                "Service account mode is enabled, but no credentials were provided."
            )
            with GOOGLE_SESSION_LOCK:
                GOOGLE_SESSION_CACHE["cache_key"] = cache_key
                GOOGLE_SESSION_CACHE["session"] = None
                GOOGLE_SESSION_CACHE["failed"] = True
            return None

        if GOOGLE_CALENDAR_SERVICE_ACCOUNT_SUBJECT:
            credentials = credentials.with_subject(GOOGLE_CALENDAR_SERVICE_ACCOUNT_SUBJECT)

        session = AuthorizedSession(credentials)
    except Exception as exc:
        app.logger.warning("Failed to initialize Google service account auth: %s", exc)
        with GOOGLE_SESSION_LOCK:
            GOOGLE_SESSION_CACHE["cache_key"] = cache_key
            GOOGLE_SESSION_CACHE["session"] = None
            GOOGLE_SESSION_CACHE["failed"] = True
        return None

    with GOOGLE_SESSION_LOCK:
        GOOGLE_SESSION_CACHE["cache_key"] = cache_key
        GOOGLE_SESSION_CACHE["session"] = session
        GOOGLE_SESSION_CACHE["failed"] = False
    return session


def calendar_api_get(url, params):
    request_params = dict(params)
    if GOOGLE_CALENDAR_AUTH_MODE == "service_account":
        session = get_google_service_session()
        if session is None:
            return None
        response = session.get(url, params=request_params, timeout=GOOGLE_CALENDAR_TIMEOUT_SECONDS)
    else:
        if not GOOGLE_CALENDAR_API_KEY:
            return None
        request_params["key"] = GOOGLE_CALENDAR_API_KEY
        response = requests.get(url, params=request_params, timeout=GOOGLE_CALENDAR_TIMEOUT_SECONDS)

    response.raise_for_status()
    return response.json()


def fetch_google_calendar_events(calendar_id, source_kind, source_label, now_local):
    if not calendar_id:
        return []

    start_of_today = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    window_end = start_of_today + timedelta(days=GOOGLE_CALENDAR_LOOKAHEAD_DAYS)
    time_min = start_of_today.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    time_max = window_end.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    fetch_limit = max(GOOGLE_CALENDAR_MAX_ITEMS * 6, 24)
    params = {
        "key": GOOGLE_CALENDAR_API_KEY,
        "singleEvents": "true",
        "orderBy": "startTime",
        "timeMin": time_min,
        "timeMax": time_max,
        "maxResults": fetch_limit,
    }
    encoded_calendar_id = quote(calendar_id, safe="")
    url = f"https://www.googleapis.com/calendar/v3/calendars/{encoded_calendar_id}/events"
    payload = calendar_api_get(url, params)
    if payload is None:
        return []

    events = []
    for item in payload.get("items", []):
        if item.get("status") == "cancelled":
            continue
        parsed = parse_google_event(item, source_kind, source_label)
        if parsed is None:
            continue
        if not is_event_active_or_upcoming(parsed, now_local):
            continue
        events.append(parsed)

    events.sort(key=lambda event: event["sort_dt"])
    return events


def get_any_cached_agenda_items():
    with AGENDA_CACHE_LOCK:
        if AGENDA_CACHE["fetched_at"] is None:
            return None
        return list(AGENDA_CACHE["items"])


def get_fresh_cached_agenda_items(now):
    if GOOGLE_CALENDAR_REFRESH_SECONDS <= 0:
        return None

    with AGENDA_CACHE_LOCK:
        fetched_at = AGENDA_CACHE["fetched_at"]
        if fetched_at is None:
            return None
        if now - fetched_at >= GOOGLE_CALENDAR_REFRESH_SECONDS:
            return None
        return list(AGENDA_CACHE["items"])


def set_agenda_cache(items, fetched_at):
    with AGENDA_CACHE_LOCK:
        AGENDA_CACHE["items"] = list(items)
        AGENDA_CACHE["fetched_at"] = fetched_at


def is_google_calendar_configured():
    return bool(
        has_google_calendar_credentials()
        and (GOOGLE_CALENDAR_EVENTS_ID or GOOGLE_CALENDAR_REMINDERS_ID)
    )


def get_google_calendar_targets():
    targets = []
    if GOOGLE_CALENDAR_EVENTS_ID:
        targets.append((GOOGLE_CALENDAR_EVENTS_ID, "event", GOOGLE_CALENDAR_EVENTS_LABEL))

    if GOOGLE_CALENDAR_REMINDERS_ID:
        if not GOOGLE_CALENDAR_EVENTS_ID or GOOGLE_CALENDAR_REMINDERS_ID != GOOGLE_CALENDAR_EVENTS_ID:
            targets.append(
                (
                    GOOGLE_CALENDAR_REMINDERS_ID,
                    "reminder",
                    GOOGLE_CALENDAR_REMINDERS_LABEL,
                )
            )
    return targets


def collect_agenda_items(now_local):
    today = now_local.date()
    events = []
    for calendar_id, source_kind, source_label in get_google_calendar_targets():
        events.extend(
            fetch_google_calendar_events(
                calendar_id=calendar_id,
                source_kind=source_kind,
                source_label=source_label,
                now_local=now_local,
            )
        )

    events.sort(key=lambda event: event["sort_dt"])
    agenda_items = []
    for event in events:
        agenda_items.append(format_agenda_item(event, today))
        if len(agenda_items) >= GOOGLE_CALENDAR_MAX_ITEMS:
            break
    return agenda_items


def get_agenda_items():
    if not SMARTDISPLAY_AGENDA_ENABLED:
        return []
    if not is_google_calendar_configured():
        return []

    now = time.time()
    fresh_cached = get_fresh_cached_agenda_items(now)
    if fresh_cached is not None:
        return fresh_cached

    try:
        now_local = datetime.now().astimezone(LOCAL_TIMEZONE)
        agenda_items = collect_agenda_items(now_local)
        set_agenda_cache(agenda_items, now)
        return agenda_items
    except Exception as exc:
        app.logger.warning("Agenda lookup failed: %s", exc)
        cached = get_any_cached_agenda_items()
        if cached is not None:
            set_agenda_cache(cached, now)
            return cached
        set_agenda_cache([], now)
        return []


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


def is_upload_enabled_and_configured():
    return bool(SMARTDISPLAY_UPLOAD_ENABLED and SMARTDISPLAY_UPLOAD_TOKEN)


def resolve_public_base_url():
    if SMARTDISPLAY_PUBLIC_BASE_URL:
        return SMARTDISPLAY_PUBLIC_BASE_URL
    return request.url_root.strip().rstrip("/")


def build_upload_url(base_url, include_token):
    if not base_url:
        return None

    upload_url = f"{base_url}/upload"
    if include_token and SMARTDISPLAY_UPLOAD_TOKEN:
        token_query = urlencode({"t": SMARTDISPLAY_UPLOAD_TOKEN})
        return f"{upload_url}?{token_query}"
    return upload_url


def get_upload_qr_data_uri(upload_url):
    if not upload_url:
        return None

    with UPLOAD_QR_CACHE_LOCK:
        if UPLOAD_QR_CACHE["url"] == upload_url and UPLOAD_QR_CACHE["data_uri"]:
            return UPLOAD_QR_CACHE["data_uri"]

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=7,
        border=1,
    )
    qr.add_data(upload_url)
    qr.make(fit=True)
    image = qr.make_image(image_factory=SvgPathImage)
    buffer = io.BytesIO()
    image.save(buffer)
    data_uri = "data:image/svg+xml;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")

    with UPLOAD_QR_CACHE_LOCK:
        UPLOAD_QR_CACHE["url"] = upload_url
        UPLOAD_QR_CACHE["data_uri"] = data_uri

    return data_uri


def build_upload_destination(filename):
    safe_name = secure_filename((filename or "").strip())
    if not safe_name:
        return None

    uploaded_name = Path(safe_name)
    suffix = uploaded_name.suffix.lower()
    if suffix not in SUPPORTED_IMAGE_EXTENSIONS:
        return None

    stem = uploaded_name.stem or "upload"
    destination = IMAGE_DIR / f"{stem}{suffix}"
    counter = 1
    while destination.exists():
        destination = IMAGE_DIR / f"{stem}_{counter}{suffix}"
        counter += 1
    return destination


def render_upload_page(status_message="", status_level="info", token=""):
    return render_template(
        "upload.html",
        status_message=status_message,
        status_level=status_level,
        token=token,
        max_upload_mb=SMARTDISPLAY_MAX_UPLOAD_MB,
        allowed_extensions=", ".join(SUPPORTED_IMAGE_EXTENSIONS),
    )


def summarize_filenames(names, limit=4):
    if not names:
        return ""

    shown = names[:limit]
    summary = ", ".join(shown)
    if len(names) > limit:
        summary += f" (+{len(names) - limit} more)"
    return summary


@app.route("/images/<path:filename>")
def serve_external_image(filename):
    if not IMAGE_DIR.is_dir():
        abort(404)
    return send_from_directory(IMAGE_DIR, filename)


@app.route("/favicon.ico")
def favicon():
    return "", 204


@app.route("/upload", methods=["GET", "POST"])
def upload_photo():
    if not SMARTDISPLAY_UPLOAD_ENABLED:
        abort(404)

    if not SMARTDISPLAY_UPLOAD_TOKEN:
        return render_upload_page(
            status_message="Upload is enabled, but SMARTDISPLAY_UPLOAD_TOKEN is not configured.",
            status_level="error",
        ), 503

    token = (request.form.get("token") or request.args.get("t") or "").strip()
    if token != SMARTDISPLAY_UPLOAD_TOKEN:
        return render_upload_page(
            status_message="Missing or invalid upload token.",
            status_level="error",
        ), 403

    if request.method == "GET":
        return render_upload_page(token=token)

    files = request.files.getlist("photos")
    if not files:
        single_file = request.files.get("photo")
        if single_file is not None:
            files = [single_file]

    selected_files = [file for file in files if file is not None and file.filename.strip()]
    if not selected_files:
        return render_upload_page(
            status_message="Choose one or more images before uploading.",
            status_level="error",
            token=token,
        ), 400

    uploaded_names = []
    invalid_names = []
    failed_names = []
    try:
        IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    except Exception as exc:
        app.logger.warning("Failed to create image directory for upload: %s", exc)
        return render_upload_page(
            status_message="Upload failed on server.",
            status_level="error",
            token=token,
        ), 500

    for file in selected_files:
        destination = build_upload_destination(file.filename)
        if destination is None:
            invalid_names.append(file.filename.strip() or "(unnamed)")
            continue

        try:
            file.save(destination)
            uploaded_names.append(destination.name)
        except Exception as exc:
            app.logger.warning("Upload failed for %s: %s", file.filename, exc)
            failed_names.append(file.filename.strip() or destination.name)

    if uploaded_names and not invalid_names and not failed_names:
        count = len(uploaded_names)
        noun = "photo" if count == 1 else "photos"
        return render_upload_page(
            status_message=(
                f"Uploaded {count} {noun}: {summarize_filenames(uploaded_names)}. "
                "They will appear automatically on the display."
            ),
            status_level="success",
            token=token,
        )

    if uploaded_names:
        details = []
        details.append(f"Uploaded {len(uploaded_names)}: {summarize_filenames(uploaded_names)}.")
        if invalid_names:
            details.append(
                f"Skipped unsupported type ({len(invalid_names)}): {summarize_filenames(invalid_names)}."
            )
        if failed_names:
            details.append(f"Failed to save ({len(failed_names)}): {summarize_filenames(failed_names)}.")
        return render_upload_page(
            status_message=" ".join(details),
            status_level="warning",
            token=token,
        )

    details = []
    if invalid_names:
        details.append(
            f"Unsupported file type ({len(invalid_names)}): {summarize_filenames(invalid_names)}."
        )
    if failed_names:
        details.append(f"Failed to save ({len(failed_names)}): {summarize_filenames(failed_names)}.")
    return render_upload_page(
        status_message=(
            "No photos were uploaded. "
            + " ".join(details)
            + f" Allowed: {', '.join(SUPPORTED_IMAGE_EXTENSIONS)}"
        ).strip(),
        status_level="error",
        token=token,
    ), 400


@app.errorhandler(413)
def request_too_large(_exc):
    if request.path == "/upload":
        token = (request.args.get("t") or "").strip()
        if token != SMARTDISPLAY_UPLOAD_TOKEN:
            token = ""
        return render_upload_page(
            status_message=(
                "Upload is too large. "
                f"Max total upload size per request is {SMARTDISPLAY_MAX_UPLOAD_MB} MB."
            ),
            status_level="error",
            token=token,
        ), 413
    return "Request too large", 413


@app.route("/")
def index():
    temp, description = get_weather()
    agenda_items = get_agenda_items()

    image_name = get_random_image_name()
    image_url = build_image_url(image_name) if image_name else None
    formatted_date = datetime.now().strftime("%A, %B %d, %Y")

    upload_qr_data_uri = None
    upload_display_target = None
    if is_upload_enabled_and_configured() and SMARTDISPLAY_SHOW_UPLOAD_QR:
        base_url = resolve_public_base_url()
        upload_url_with_token = build_upload_url(base_url, include_token=True)
        upload_public_url = build_upload_url(base_url, include_token=False)
        if upload_url_with_token:
            upload_qr_data_uri = get_upload_qr_data_uri(upload_url_with_token)
        if upload_public_url:
            upload_display_target = urlsplit(upload_public_url).netloc or upload_public_url

    return render_template(
        "index.html",
        temp=temp,
        description=description,
        temp_unit=TEMP_UNIT,
        formatted_date=formatted_date,
        image_name=image_name,
        image_url=image_url,
        refresh_seconds=REFRESH_SECONDS,
        layout_mode=LAYOUT_MODE,
        transition_mode=TRANSITION_MODE,
        agenda_enabled=SMARTDISPLAY_AGENDA_ENABLED,
        agenda_items=agenda_items,
        upload_qr_data_uri=upload_qr_data_uri,
        upload_display_target=upload_display_target,
    )


if __name__ == "__main__":
    app.run(host=HOST, port=PORT)
