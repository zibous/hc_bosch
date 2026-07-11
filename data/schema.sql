CREATE TABLE sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        start_time TEXT NOT NULL,
                        end_time TEXT,
                        program TEXT,
                        phase TEXT,
                        duration_min REAL,
                        energy_forecast INTEGER,
                        water_forecast INTEGER,
                        energy_kwh_start REAL,
                        energy_kwh_end REAL,
                        energy_kwh REAL,
                        water_m3_start REAL,
                        water_m3_end REAL,
                        water_liters REAL,
                        result TEXT DEFAULT 'unknown'
                    , water_estimated INTEGER DEFAULT 0);
CREATE TABLE sqlite_sequence(name,seq);
CREATE TABLE daily_summary (
                        date TEXT PRIMARY KEY,
                        sessions_count INTEGER DEFAULT 0,
                        total_duration_min REAL DEFAULT 0,
                        avg_energy_forecast REAL DEFAULT 0,
                        avg_water_forecast REAL DEFAULT 0,
                        total_energy_kwh REAL DEFAULT 0,
                        total_water_liters REAL DEFAULT 0
                    );
CREATE TABLE state_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        state TEXT,
                        door TEXT,
                        power TEXT,
                        program TEXT,
                        phase TEXT,
                        progress INTEGER,
                        remaining TEXT,
                        energy_forecast INTEGER,
                        water_forecast INTEGER
                    );
CREATE TABLE session_readings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER NOT NULL,
                        timestamp TEXT NOT NULL,
                        power_w REAL,
                        energy_kwh REAL,
                        water_m3 REAL
                    , phase TEXT);
