#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from datetime import datetime
from pathlib import Path
import yaml
import logging
logger = logging.getLogger(__name__) # Nutzt automatisch die Konfiguration aus app.py


class DishwasherAnalytics:

    def __init__(self, db=None):

        self.STATIC_DIR = Path(__file__).parent.parent / "dashboard" / "static"
        self.COSTS_FILE = Path(__file__).parent.parent / "config" / "costs.yaml"
        self.LANG_FILE = Path(__file__).parent.parent / "config" / "lang" / "de.yaml"
        self.db = db

    def load_lang(self) -> dict:
        """Lädt die Sprachkonfiguration aus YAML."""
        try:
            if self.LANG_FILE.is_file():
                with open(self.LANG_FILE, "r", encoding="utf8") as f:
                    return yaml.safe_load(f) or {}
        except Exception as e:
            logger.warning(f"Failed to load lang file: {e}")
        return {}

    def load_costs(self) -> dict:
        """Lädt die Kostenkonfiguration aus YAML."""
        try:
            if self.COSTS_FILE.is_file():
                with open(self.COSTS_FILE, "r", encoding="utf8") as f:
                    return yaml.safe_load(f) or {}
        except Exception as e:
            logger.warning(f"Failed to load costs.yaml: {e}")
        return {}

    def get_costs_for_year(self, year: int, all_costs: dict = None) -> dict:
        """Sucht die Kosten für ein Jahr mit automatischem Fallback."""
        costs = all_costs if all_costs is not None else self.load_costs()
        if year in costs:
            return costs[year]
        if costs:
            return costs[max(costs.keys())]
        return {"strom": 0.23, "wasser": 6.97}

    def enrich_single_session(self, session: dict, all_costs: dict = None) -> dict:
        """Berechnet kWh, Liter und Gesamtkosten für eine einzelne Wasch-Session."""
        if not session:
            return session
        try:
            year = int(session.get("start_time", "")[:4])
        except (ValueError, TypeError):
            year = datetime.now().year

        if all_costs is None:
            all_costs = self.load_costs()

        costs = self.get_costs_for_year(year, all_costs)

        kwh = session.get("energy_kwh") or round(1.05 * (session.get("energy_forecast") or 0) / 100, 3)
        liters = session.get("water_liters") or round(10 * (session.get("water_forecast") or 0) / 100, 1)

        session["kwh"] = kwh
        session["liters"] = liters
        session["kwh_estimate"] = kwh
        session["liters_estimate"] = liters
        session["cost_strom"] = round(kwh * costs.get("strom", 0), 3)
        session["cost_wasser"] = round((liters / 1000) * costs.get("wasser", 0), 3)
        session["cost_total"] = round(session["cost_strom"] + session["cost_wasser"], 3)
        return session

    def process_period_stats(self, stats: dict, costs: dict) -> dict:
        """Berechnet die Verbräuche und Kosten für Zeiträume (Monat & Jahr) in den Statistiken."""
        if not stats:
            return {}

        processed = dict(stats)
        processed["costs"] = costs

        for prefix in ("month", "year"):
            sum_e = processed.get(f"{prefix}_sum_energy", 0)
            sum_w = processed.get(f"{prefix}_sum_water", 0)
            real_kwh = processed.get(f"{prefix}_real_kwh", 0)
            real_liters = processed.get(f"{prefix}_real_liters", 0)

            kwh = round(real_kwh, 2) if real_kwh > 0 else round(1.05 * sum_e / 100, 2)
            liters = round(real_liters, 1) if real_liters > 0 else round(10 * sum_w / 100, 1)
            m3 = liters / 1000

            processed[f"{prefix}_kwh"] = kwh
            processed[f"{prefix}_liters"] = liters
            processed[f"{prefix}_cost_strom"] = round(kwh * costs.get("strom", 0), 2)
            processed[f"{prefix}_cost_wasser"] = round(m3 * costs.get("wasser", 0), 2)
            processed[f"{prefix}_cost_total"] = round(
                processed[f"{prefix}_cost_strom"] + processed[f"{prefix}_cost_wasser"], 2
            )
        return processed

    def enrich_monthly(self, monthly: list, costs: dict) -> list:
        """Berechnet kwh, liters und Kosten für Monatsdaten."""
        for m in monthly:
            real_kwh = m.get("total_energy_kwh", 0)
            real_liters = m.get("total_water_liters", 0)
            sum_e = m.get("sum_energy_forecast", 0)
            sum_w = m.get("sum_water_forecast", 0)

            m["kwh"] = round(real_kwh, 3) if real_kwh > 0 else round(1.05 * sum_e / 100, 3)
            m["liters"] = round(real_liters, 1) if real_liters > 0 else round(10 * sum_w / 100, 1)
            m["cost_strom"] = round(m["kwh"] * costs.get("strom", 0), 2)
            m["cost_wasser"] = round((m["liters"] / 1000) * costs.get("wasser", 0), 2)
            m["cost_total"] = round(m["cost_strom"] + m["cost_wasser"], 2)
        return monthly

    def process_live_session_readings(self, readings: list, session_data: dict, active: bool) -> list:
        """Berechnet die relativen Sensor-Änderungen (Wasser/Strom) für das Live-Chart."""
        if not readings:
            return []

        e_start = readings[0].get("energy_kwh")
        w_start = readings[0].get("water_m3")

        for r in readings:
            if e_start is not None and r.get("energy_kwh") is not None:
                r["kwh_rel"] = round(r["energy_kwh"] - e_start, 4)
            else:
                r["kwh_rel"] = None

            if w_start is not None and r.get("water_m3") is not None:
                r["liters_rel"] = round((r["water_m3"] - w_start) * 1000, 2)
            else:
                r["liters_rel"] = None

        if not active and session_data and session_data.get("water_estimated"):
            corrected_liters = session_data.get("water_liters")
            raw_total = readings[-1].get("liters_rel")
            if corrected_liters and raw_total and raw_total > 0:
                scale = corrected_liters / raw_total
                for r in readings:
                    if r.get("liters_rel") is not None:
                        r["liters_rel"] = round(r["liters_rel"] * scale, 2)

        return readings
