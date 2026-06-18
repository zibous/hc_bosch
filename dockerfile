FROM python:3.12-slim

# Environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Europe/Berlin

LABEL maintainer="Peter Siebler <peter.siebler@gmail.com>" \
      application="Dashboard Bosch Home Connect" \
      version="2.2.0" \
      com.centurylinklabs.watchtower.enable="false" \
      dockerhand.check-update="false" \
      dockerhand.ignore="true"

WORKDIR /app

COPY ./requirements.txt ./

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc python3-dev libssl-dev libxml2-dev libxslt-dev jq && \
    pip install --no-cache-dir --upgrade --root-user-action=ignore \
        -r requirements.txt && \
    apt-get purge -y gcc python3-dev libssl-dev libxml2-dev libxslt-dev && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY ./ /app

HEALTHCHECK --interval=60s --timeout=5s --retries=3 --start-period=10s \
    CMD python3 -c "import os; import urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"DASHBOARD_PORT\",5021)}/api/health')" || exit 1

CMD ["python", "main.py"]
