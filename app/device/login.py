#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
OAuth login flow for Bosch-Siemens Home Connect cloud.

Follows the PKCE authorization code flow to obtain device configuration.
Based on: https://github.com/osresearch/hcpy
"""

import io
import json
import os
import re
import sys
from base64 import urlsafe_b64encode as base64url_encode
from zipfile import ZipFile

import requests
from Crypto.Hash import SHA256
from Crypto.Random import get_random_bytes
from lxml import html
from urllib.parse import urlparse, parse_qs, urlencode

_rootdir = os.path.dirname(os.path.realpath(__file__))
sys.path.append(_rootdir)
sys.path.append(f"{_rootdir}/lib")
sys.path.append(f"{_rootdir}/lib/hc")

from app.core import utils
from app.core.config import settings as app_config
from app.device.xml2json import xml2json

import logging
logger = logging.getLogger(__name__)


def _b64(b: bytes) -> str:
    """Base64url encode without padding."""
    return re.sub(r"=", "", base64url_encode(b).decode("UTF-8"))


def _b64random(num: int) -> str:
    """Generate a random base64url string."""
    return _b64(base64url_encode(get_random_bytes(num)))


def getConfig(brand: str, connection: dict) -> bool:
    """Get the device configuration for the defined brand.

    If a cached config file exists, returns True immediately.
    Otherwise, logs into the Bosch cloud to fetch device details.
    """
    try:
        logger.debug("hc login getConfig started")

        _filename = os.path.join(app_config.CONFIG_DIR, brand, app_config.DEVICES_FILENAME)

        if os.path.isfile(_filename):
            if "testcase" in connection:
                logger.debug("Testcase enabled, try to get the devices data")
            else:
                logger.info(f"Config file {_filename} present. Skip cloud login.")
                return True

        _debugMode = app_config.DEBUG

        logger.debug("Fetching config from Bosch Cloud")
        base_url = "https://api.home-connect.com/security/oauth/"
        asset_url = "https://prod.reu.rest.homeconnectegw.com/"

        app_id = "9B75AC9EC512F36C84256AC47D813E2C1DD0D6520DF774B020E1E6E2EB29B1F3"
        scope = [
            "ReadAccount", "Settings", "IdentifyAppliance", "Control",
            "DeleteAppliance", "WriteAppliance", "ReadOrigApi", "Monitor",
            "WriteOrigApi", "Images",
        ]

        verifier = _b64(get_random_bytes(32))
        login_query = {
            "response_type": "code",
            "prompt": "login",
            "code_challenge": _b64(SHA256.new(verifier.encode("UTF-8")).digest()),
            "code_challenge_method": "S256",
            "client_id": app_id,
            "scope": " ".join(scope),
            "nonce": _b64random(16),
            "state": _b64random(16),
            "redirect_uri": "hcauth://auth/prod",
            "redirect_target": "icore",
        }

        loginpage_url = base_url + "authorize?" + urlencode(login_query)
        auth_url = base_url + "login"
        token_url = base_url + "token"

        # Fetch login page
        r = requests.get(loginpage_url)
        if r.status_code != requests.codes.ok:
            logger.error(f"Error fetching login URL: {loginpage_url}")
            return False

        tree = html.fromstring(r.text)

        auth_fields: dict = {
            "email": connection["email"],
            "password": connection["password"],
            "code_challenge": login_query["code_challenge"],
            "code_challenge_method": login_query["code_challenge_method"],
            "redirect_uri": login_query["redirect_uri"],
        }

        for form in tree.forms:
            if form.attrib.get("id") != "login_form":
                continue
            for field in form.fields:
                if field not in auth_fields:
                    auth_fields[field] = form.fields.get(field)

        if _debugMode:
            logger.debug(f"auth_fields: {auth_fields}")

        # Submit login form
        r = requests.post(auth_url, data=auth_fields, allow_redirects=False)
        if r.status_code != 302:
            logger.error(f"Login failed (no redirect). Wrong username/password? {r.status_code}")
            return False

        location = r.headers["location"]
        url = urlparse(location)
        query = parse_qs(url.query)

        code = query.get("code")
        if not code:
            logger.error(f"Unable to find code in response: {location}")
            return False

        # Exchange code for token
        token_fields = {
            "grant_type": "authorization_code",
            "client_id": app_id,
            "code_verifier": verifier,
            "code": code[0],
            "redirect_uri": login_query["redirect_uri"],
        }

        r = requests.post(token_url, data=token_fields, allow_redirects=False)
        if r.status_code != requests.codes.ok:
            logger.error(f"Token exchange failed: {r.status_code}")
            return False

        token = json.loads(r.text)["access_token"]
        if _debugMode:
            logger.debug(f"Received access token: {token[:20]}...")

        headers = {"Authorization": "Bearer " + token}

        # Fetch account details
        r = requests.get(asset_url + "account/details", headers=headers)
        if r.status_code != requests.codes.ok:
            logger.error(f"Unable to fetch account details: {r.status_code}")
            return False

        account = json.loads(r.text)
        configs: list[dict] = []

        if _debugMode:
            _acct_file = os.path.join(app_config.CONFIG_DIR, brand, "account.json")
            utils.savefile(account, _acct_file)

        for app in account["data"]["homeAppliances"]:
            app_brand = app["brand"]
            app_type = app["type"]
            app_identifier = app["identifier"]
            config: dict = {"name": app_type.lower()}
            configs.append(config)

            if "tls" in app:
                config["host"] = f"{app_brand}-{app_type}-{app_identifier}"
                config["key"] = app["tls"]["key"]
                config["tls"] = True
            else:
                config["host"] = app_identifier
                config["key"] = app["aes"]["key"]
                config["iv"] = app["aes"]["iv"]
                config["tls"] = False

            config["friendly_name"] = app["name"]
            config["brand"] = app["brand"]
            config["type"] = app_type
            config["identifier"] = app_identifier

            if app_config.HA_DISCOVERY:
                config["brandname"] = brand.lower()
                config["deviceid"] = f"{brand}-{config['name']}"
                config["discovery_prefix"] = app_config.HA_DISCOVERY_PREFIX
                config["ha_schema"] = os.path.join(
                    app_config.CONFIG_DIR, brand, config["name"], app_config.HA_SCHEMA_FILE
                )
                config["ha_items"] = os.path.join(
                    app_config.CONFIG_DIR, brand, config["name"], app_config.HA_DISCOVERY_FILE
                )

            # Fetch device XML description
            app_url = f"{asset_url}api/iddf/v1/iddf/{app_identifier}"
            logger.debug(f"Fetching device description: {app_url}")

            r = requests.get(app_url, headers=headers)
            if r.status_code != requests.codes.ok:
                logger.warning(f"Unable to fetch machine description for {app_identifier}")
                continue

            z = ZipFile(io.BytesIO(r.content))
            features = z.open(f"{app_identifier}_FeatureMapping.xml").read()
            description = z.open(f"{app_identifier}_DeviceDescription.xml").read()

            machine = xml2json(features, description)

            if _debugMode:
                _machine_file = os.path.join(
                    app_config.CONFIG_DIR, brand, app_type.lower(), "machine.json"
                )
                utils.savefile(machine, _machine_file)

            config["description"] = machine["description"]
            config["features"] = machine["features"]
            config["config"] = connection[app_identifier]
            config["appsversion"] = app_config.APPS_VERSION
            config["created"] = app_config.getTimestamp()

        # Save the configuration
        _filename = os.path.join(app_config.CONFIG_DIR, brand, app_config.DEVICES_FILENAME)
        if utils.savefile(configs, _filename, "json"):
            logger.info(f"Config saved: {_filename}")
            return True
        else:
            logger.error(f"Config not saved: {_filename}")
            return False

    except Exception as e:
        tb = sys.exc_info()[-1]
        lineno = tb.tb_lineno if tb else "?"
        logger.error(f"hc login error: {e}, line {lineno}")
        return False
