import os
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
import yaml
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Pfad-Ermittlung relativ zu dieser Datei
_CORE_DIR = Path(__file__).resolve().parent
_APP_DIR = _CORE_DIR.parent
_ROOT_DIR = _APP_DIR.parent

class Settings(BaseSettings):
    # Pydantic liest die .env Datei automatisch aus dem Root-Verzeichnis
    model_config = SettingsConfigDict(
        env_file=os.path.join(_ROOT_DIR, ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # -----------------------------------------
    # Application & Paths
    # -----------------------------------------
    APPS_VERSION: str = ""
    PROJECT_NAME: str = "Bosch Dishwasher Dashboard"
    API_V1_STR: str = "/api/v1"
    DATA_HOSTNAME: str = Field(default="Docker App", env="DATA_HOSTNAME")
    ATTRIBUTION: str = Field(default="Data provided by home-connect-mqtt", env="ATTRIBUTION")
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    DEVICES_FILENAME: str = "devices.json"

    ROOT_DIR: str = str(_ROOT_DIR)
    DATA_DIR: str = os.path.join(str(_ROOT_DIR), "data")
    CONFIG_DIR: str = os.path.join(str(_APP_DIR), "config")
    DB_PATH: str = os.path.join(DATA_DIR, "dishwasher.db")

    FRONTEND_DIR: str = os.path.join(str(_ROOT_DIR), "frontend")

    @property
    def getDate(self) -> Any:
        """Gibt die originale getDate-Funktion aus den utils zurück."""
        from app.core.utils import getDate
        return getDate

    @property
    def getTimestamp(self) -> Any:
        """Gibt die originale getTimestamp-Funktion aus den utils zurück."""
        from app.core.utils import getTimestamp
        return getTimestamp

    @property
    def DEBUG(self) -> bool:
        return self.LOG_LEVEL.upper() == "DEBUG"

    # KORREKTUR: Eigenschaft hinzugefügt, um den Fehler 'has no attribute DEVICES' zu beheben
    @property
    def DEVICES(self) -> dict:
        """Abwärtskompatibilität für alte Skripte, die app_config.DEVICES erwarten."""
        return self.load_devices()

    # -----------------------------------------
    # MQTT
    # -----------------------------------------
    MQTT_HOST: str = Field(default="localhost", env="MQTT_HOST")
    MQTT_PORT: int = Field(default=1883, env="MQTT_PORT")
    MQTT_TOPIC_BASE: str = Field(default="bosch-dishwasher", env="MQTT_TOPIC_BASE")
    MQTT_KEEPALIVE: int = Field(default=60, env="MQTT_KEEPALIVE")
    HEARTBEAT_TIME: int = Field(default=60, env="HEARTBEAT_TIME")

    MQTT_USER: str = Field(default="", env="MQTT_USER")
    MQTT_PASS: str = Field(default="", env="MQTT_PASS")

    @property
    def MQTT_AUTH(self) -> Any:
        if self.MQTT_USER and self.MQTT_USER.strip() != "":
            return {"username": self.MQTT_USER.strip(), "password": self.MQTT_PASS.strip()}
        return None

    # -----------------------------------------
    # Home Assistant Discovery
    # -----------------------------------------
    HA_DISCOVERY: bool = Field(default=True, env="HA_DISCOVERY")
    HA_DISCOVERY_PREFIX: str = Field(default="homeassistant", env="HA_DISCOVERY_PREFIX")
    HA_SCHEMA_FILE: str = "schemalist.yaml"
    HA_DISCOVERY_FILE: str = "discovery.yaml"

    # -----------------------------------------
    # Dashboard & Forecasts
    # -----------------------------------------
    DASHBOARD_PORT: int = Field(default=5021, env="DASHBOARD_PORT")
    DASHBOARD_LIVE_DAYS: int = Field(default=14, env="DASHBOARD_LIVE_DAYS")
    FORECAST_ENERGY_MAX_KWH: float = Field(default=1.05, env="FORECAST_ENERGY_MAX_KWH")
    FORECAST_WATER_MAX_L: float = Field(default=13.0, env="FORECAST_WATER_MAX_L")

    # -----------------------------------------
    # Sessions & Sensors
    # -----------------------------------------
    SAVE_SESSIONS: bool = Field(default=True, env="SAVE_SESSIONS")
    SESSIONS_DIR: str = Field(default="./data/sessions", env="SESSIONS_DIR")
    SESSIONS_KEEP: int = Field(default=10, env="SESSIONS_KEEP")

    SENSOR_WATER_URL: str = Field(default="", env="SENSOR_WATER_URL")
    SENSOR_ENERGY_URL: str = Field(default="", env="SENSOR_ENERGY_URL")

    # -----------------------------------------
    # Webhooks
    # -----------------------------------------
    HA_WEBHOOK_URL: str = Field(default="", env="HA_WEBHOOK_URL")
    HA_WEBHOOK_ID: str = Field(default="", env="HA_WEBHOOK_ID")

    # -----------------------------------------
    # Hilfsfunktionen für externe Dateien
    # -----------------------------------------
    def load_devices(self) -> dict:
        """Lädt die Gerätekonfiguration (devices.yaml) und injiziert ENV-Credentials."""
        yaml_path = os.path.join(self.CONFIG_DIR, "devices.yaml")
        if not os.path.isfile(yaml_path):
            return {}

        with open(yaml_path, "r", encoding="utf8") as f:
            devices = yaml.safe_load(f) or {}

        for brand_name, brand_data in devices.items():
            if isinstance(brand_data, dict):
                brand_data["email"] = os.getenv(f"{brand_name.upper()}_EMAIL", "")
                brand_data["password"] = os.getenv(f"{brand_name.upper()}_PASSWORD", "")
                # Injektion der abgeleiteten Werte für HA Discovery
                brand_lower = brand_name.lower()
                brand_data["brandname"] = brand_lower
                brand_data["deviceid"] = f"{brand_lower}-{brand_data.get('name', 'unknown')}"
                brand_data["discovery_prefix"] = self.HA_DISCOVERY_PREFIX
                brand_data["ha_schema"] = os.path.join(self.CONFIG_DIR, self.HA_SCHEMA_FILE)
                brand_data["ha_items"] = os.path.join(self.CONFIG_DIR, self.HA_DISCOVERY_FILE)

        return devices

    def load_costs(self) -> dict:
        """Lädt Tarife aus config/costs.yaml für das aktuelle Jahr."""
        costs_file = os.path.join(self.CONFIG_DIR, "costs.yaml")
        try:
            if os.path.isfile(costs_file):
                with open(costs_file, "r", encoding="utf8") as f:
                    all_costs = yaml.safe_load(f) or {}
                year = datetime.now().year
                if year in all_costs:
                    return all_costs[year]
                if all_costs:
                    return all_costs[max(all_costs.keys())]
        except Exception:
            pass
        return {"strom": 0.23, "wasser": 6.97} # Fallback

    def load_lang(self) -> dict:
        """Liest die UI-Texte aus app/config/lang/de.yaml."""
        path = os.path.join(self.CONFIG_DIR, "lang", "de.yaml")
        if not os.path.exists(path):
            return {}
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)


# Instanziierung des singletons für die gesamte App
settings = Settings()

# --- MODUL-EXPORT-PROXIES FÜR COMPATIBILITY ---
DEVICES = settings.DEVICES
MQTT_TOPIC_BASE = settings.MQTT_TOPIC_BASE
MQTT_HOST = settings.MQTT_HOST
MQTT_PORT = settings.MQTT_PORT
MQTT_KEEPALIVE = settings.MQTT_KEEPALIVE
MQTT_AUTH = settings.MQTT_AUTH
DATADIR = settings.DATA_DIR
CONFIG_DIR = settings.CONFIG_DIR
DB_PATH = settings.DB_PATH
SESSIONS_DIR = settings.SESSIONS_DIR
SAVE_SESSIONS = settings.SAVE_SESSIONS
SESSIONS_KEEP = settings.SESSIONS_KEEP
APPS_VERSION = settings.APPS_VERSION
HA_DISCOVERY_PREFIX = settings.HA_DISCOVERY_PREFIX
DEBUG = settings.DEBUG
