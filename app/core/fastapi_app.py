# app/core/fastapi_app.py
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.api.endpoints import router as api_router

class NoCacheMiddleware(BaseHTTPMiddleware):
    """Setzt Cache-Control Header für die UI-Hauptseiten analog zu Flask."""
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        path = request.url.path
        if path in ("/", "/index.html"):
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response

# Das App-Objekt wird hier erzeugt
app = FastAPI(title=settings.PROJECT_NAME, version="2.0.0")

# Dynamische State-Platzhalter für app.py Injektion
app.state.db = None
app.state.get_state_fn = None
app.state.sensors = None

# Globaler CORS-Schutz
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(NoCacheMiddleware)

app.include_router(api_router, prefix="/api")

# Statische Frontend-Dateien bereitstellen
if os.path.exists(settings.FRONTEND_DIR):
    @app.get("/")
    def read_index():
        return FileResponse(os.path.join(settings.FRONTEND_DIR, "index.html"))

    app.mount("/", StaticFiles(directory=settings.FRONTEND_DIR, html=True), name="frontend")
