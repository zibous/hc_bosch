import os
import json
from app.core.config import settings
from app.schemas.dishwasher import CurrentStateSchema

class DishwasherService:
    def __init__(self):
        self.costs = settings.load_costs()

    def get_live_status(self) -> CurrentStateSchema:
        """Liest den aktuellen MQTT-Zustand aus der Datenschicht."""
        status_file = os.path.join(settings.DATA_DIR, "status.json")

        if not os.path.exists(status_file):
            return CurrentStateSchema(
                state="Unknown", program="None", phase="None",
                progress=0, remaining_time="0:00", tabs_remaining=0, door_closed=True
            )

        with open(status_file, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        state_data = raw_data.get("state", {})

        return CurrentStateSchema(
            state=state_data.get("state", "Ready"),
            program=state_data.get("selectedprogram", "Eco 50°"),
            phase=state_data.get("phase", "Bereit"),
            progress=state_data.get("progress", 0),
            remaining_time=state_data.get("remaining", "0:00"),
            tabs_remaining=state_data.get("tabs_remaining", 0),
            door_closed=state_data.get("door") == "Closed"
        )
