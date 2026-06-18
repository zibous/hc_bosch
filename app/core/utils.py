#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Utility functions for home-connect-mqtt.
Only contains functions that are actually used in the project.
"""

import json
import os
from datetime import datetime

import yaml


def loadYaml(filename: str = "") -> dict | None:
    """Load and parse a YAML file."""
    if filename:
        with open(filename, "r", encoding="utf8") as f:
            try:
                return yaml.safe_load(f)
            except yaml.YAMLError as exc:
                print(exc)
                return None
    return None


def savefile(content, filename: str | None = None, datatype: str = "json") -> bool:
    """Save content to a file as JSON or plain text."""
    if not content or not filename or not datatype:
        return False
    try:
        _path = os.path.dirname(filename)
        os.makedirs(_path, exist_ok=True)
        with open(filename, "w", encoding="utf8") as f:
            if datatype == "json":
                f.write(json.dumps(content, sort_keys=False, indent=4, ensure_ascii=False))
            elif datatype == "text":
                f.write(content)
        return True
    except Exception:
        return False


def now() -> datetime:
    """Return current datetime."""
    return datetime.now()


def strToDate(theDate, date_format: str = "%Y-%m-%dT%H:%M:%S") -> datetime | None:
    """Convert a string to a datetime object."""
    try:
        if isinstance(theDate, str):
            return datetime.strptime(theDate, date_format)
        if isinstance(theDate, datetime):
            return theDate
    except ValueError as e:
        print(f"Error {__name__}: strToDate, {e}")
    return None


def runningTime(total_seconds) -> str:
    """Format seconds into a human-readable duration string."""
    try:
        if total_seconds < 1.0:
            return f"{total_seconds * 1000:.0f} ms"

        MINUTE = 60
        HOUR = MINUTE * 60
        DAY = HOUR * 24

        days = int(total_seconds / DAY)
        hours = int((total_seconds % DAY) / HOUR)
        minutes = int((total_seconds % HOUR) / MINUTE)
        seconds = int(total_seconds % MINUTE)

        parts = []
        if days > 0:
            parts.append(f"{days} {'day' if days == 1 else 'days'}")
        if parts or hours > 0:
            parts.append(f"{hours} {'hour' if hours == 1 else 'hours'}")
        if parts or minutes > 0:
            parts.append(f"{minutes} {'minute' if minutes == 1 else 'minutes'}")
        parts.append(f"{seconds} {'second' if seconds == 1 else 'seconds'}")

        return ", ".join(parts)
    except Exception as e:
        print(f"Error {__name__}: runningTime, {e}")
        return ""


def loadjsondata(filename: str | None = None) -> dict | list | None:
    """Load JSON data from a file."""
    try:
        if filename and os.path.isfile(filename):
            with open(filename, "r", encoding="utf8") as f:
                return json.load(f)
    except Exception as e:
        print(f"Error {__name__}: loadjsondata, {e}")
    return None

_DATEFORMAT = "%Y-%m-%d %H:%M:%S"
_DATEFORMAT_TS = "%Y-%m-%dT%H:%M:%S"

def getTimestamp() -> str:
    """ISO Timestamp: 2026-04-27T08:30:00"""
    return datetime.now().strftime(_DATEFORMAT_TS)

def getDate() -> str:
    """Datum: 2026-04-27 08:30:00"""
    return datetime.now().strftime(_DATEFORMAT)