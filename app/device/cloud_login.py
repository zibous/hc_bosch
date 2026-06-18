#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Interactive OAuth login for Bosch-Siemens Home Connect cloud.

This is the manual/interactive version that requires pasting a code from the browser.
For automated login, see login.py.

Usage:
    python3 -m lib.hc.cloud_login config/bosch_new/devices.json

Steps:
    1. Open the printed URL in Chrome
    2. Login with your Bosch account
    3. Press F12 to see developer tools → Network tab
    4. After login, the browser tries to open hcauth://... (this will fail)
    5. Copy the 'code' parameter from the URL
    6. Paste it when prompted

Based on: https://github.com/osresearch/hcpy
"""

import io
import json
import os
import re
import sys
from base64 import urlsafe_b64decode, urlsafe_b64encode as base64url_encode
from urllib.parse import unquote, urlencode
from zipfile import ZipFile

import requests
from Crypto.Hash import SHA256
from Crypto.Random import get_random_bytes

# Use the shared xml2json from lib/hc/
_hcdir = os.path.dirname(os.path.realpath(__file__))
_rootdir = os.path.dirname(os.path.dirname(_hcdir))
sys.path.insert(0, _hcdir)
from xml2json import xml2json


def _b64(b: bytes) -> str:
    return re.sub(r"=", "", base64url_encode(b).decode("UTF-8"))


def _b64random(num: int) -> str:
    return _b64(base64url_encode(get_random_bytes(num)))


def _b64url_decode(data: str) -> bytes:
    data += "=" * (-len(data) % 4)
    return urlsafe_b64decode(data)


def cloud_login(devicefile: str) -> None:
    """Run the interactive cloud login flow."""

    base_url = "https://api.home-connect.com/security/oauth/"
    asset_urls = [
        "https://eu.services.home-connect.com/",
        "https://na.services.home-connect.com/",
    ]

    app_id = "9B75AC9EC512F36C84256AC47D813E2C1DD0D6520DF774B020E1E6E2EB29B1F3"
    scope = ["ReadOrigApi"]

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
    }

    loginpage_url = base_url + "authorize?" + urlencode(login_query)
    token_url = base_url + "token"

    print("Visit the following URL in Chrome, use F12 developer tools")
    print("to monitor network responses, and look for the request starting")
    print("hcauth://auth for the relevant authentication tokens:")
    print()
    print(loginpage_url)
    print()

    code = unquote(input("Input code: "))
    state = input("Input state: ")

    print(f"code={code[:20]}... state={state[:20]}...", file=sys.stderr)

    # Exchange code for token
    token_fields = {
        "grant_type": "authorization_code",
        "client_id": app_id,
        "code_verifier": verifier,
        "code": code,
        "redirect_uri": login_query["redirect_uri"],
    }

    r = requests.post(token_url, data=token_fields, allow_redirects=False)
    if r.status_code != requests.codes.ok:
        print(f"Token exchange failed: {r.status_code}", file=sys.stderr)
        print(r.text, file=sys.stderr)
        sys.exit(1)

    token = json.loads(r.text)["access_token"]
    print(f"Received access token: {token[:20]}...", file=sys.stderr)

    headers = {"Authorization": "Bearer " + token}

    # Decode JWT to get subject
    _header_b64, payload_b64, _signature_b64 = token.split(".")
    payload = json.loads(_b64url_decode(payload_b64))
    subject = payload.get("sub")

    # Find the right geo endpoint
    asset_url = ""
    appliances = None
    for url in asset_urls:
        r = requests.get(
            url + "/api/account/v2/accounts/" + subject + "/paired-appliances",
            headers=headers,
        )
        if r.status_code == requests.codes.ok:
            asset_url = url
            appliances = json.loads(r.text)
            break

    if not appliances:
        print("Unable to fetch account details", file=sys.stderr)
        sys.exit(1)

    configs = []
    xml_dir = os.path.join(os.path.dirname(os.path.realpath(__file__)), "..", "..", "scripts", "xml")
    os.makedirs(xml_dir, exist_ok=True)

    for app in appliances["appliances"]:
        app_brand = app["brand"]
        app_type = app["haType"]
        app_id_dev = app["haId"]

        config = {"name": app_type.lower()}
        configs.append(config)

        # Fetch encryption details
        enc_url = asset_url + "/api/appliance/v2/appliances/" + app_id_dev + "/encryption-information"
        r = requests.get(enc_url, headers=headers)
        if r.status_code != requests.codes.ok:
            print(f"Unable to fetch encryption for {app_id_dev}", file=sys.stderr)
            continue

        enc = json.loads(r.text)
        tls = enc.get("tls")
        aes = enc.get("aes")

        if tls:
            config["host"] = f"{app_brand}-{app_type}-{app_id_dev}"
            config["key"] = tls["key"]
        else:
            config["host"] = app_id_dev
            config["key"] = aes["key"]
            config["iv"] = aes["iv"]

        # Fetch device XML description
        app_url = f"{asset_url}api/iddf/v1/iddf/{app_id_dev}"
        print(f"Fetching: {app_url}", file=sys.stderr)
        r = requests.get(app_url, headers=headers)
        if r.status_code != requests.codes.ok:
            print(f"Unable to fetch machine description for {app_id_dev}", file=sys.stderr)
            continue

        # Save ZIP and extract XML to scripts/xml/
        content = r.content
        zip_path = os.path.join(xml_dir, f"{app_id_dev}.zip")
        with open(zip_path, "wb") as f:
            f.write(content)
        print(f"Saved ZIP: {zip_path}", file=sys.stderr)

        z = ZipFile(io.BytesIO(content))
        for name in z.namelist():
            xml_file = os.path.join(xml_dir, name)
            with open(xml_file, "wb") as f:
                f.write(z.read(name))
            print(f"Extracted: {xml_file}", file=sys.stderr)

        features = z.open(f"{app_id_dev}_FeatureMapping.xml").read()
        description = z.open(f"{app_id_dev}_DeviceDescription.xml").read()

        machine = xml2json(features, description)
        config["description"] = machine["description"]
        config["features"] = machine["features"]
        print(f"Discovered device: {config['name']} - Host: {config['host']}")

    # Save devices.json
    os.makedirs(os.path.dirname(os.path.abspath(devicefile)), exist_ok=True)
    with open(devicefile, "w") as f:
        json.dump(configs, f, ensure_ascii=True, indent=4)
    print(f"Saved: {devicefile}")

    # Also save to config/bosch_new/
    new_dir = os.path.join(_rootdir, "config", "bosch_new")
    os.makedirs(new_dir, exist_ok=True)
    new_file = os.path.join(new_dir, "devices.json")
    with open(new_file, "w") as f:
        json.dump(configs, f, ensure_ascii=True, indent=4)
    print(f"Also saved: {new_file}")

    print("Success. You can now compare config/bosch_new/devices.json with config/bosch/devices.json")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python3 {sys.argv[0]} <output-devices.json>")
        print(f"  e.g. python3 {sys.argv[0]} config/bosch_new/devices.json")
        sys.exit(1)
    cloud_login(sys.argv[1])
