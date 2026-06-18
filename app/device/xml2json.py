#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Convert Home Connect XML feature mapping and device description
into a single JSON structure.

Based on: https://github.com/osresearch/hcpy
"""

import sys
import xml.etree.ElementTree as ET


def parse_xml_list(codes: dict, entries, enums: dict) -> None:
    """Parse XML entries and merge them into the codes dict."""
    for el in entries:
        uid = int(el.attrib["uid"], 16)

        if uid not in codes:
            print(f"UID {uid} not known!", file=sys.stderr)
            continue

        data = codes[uid]

        for key in el.attrib:
            data[key] = el.attrib[key]

        if "enumerationType" in el.attrib:
            del data["enumerationType"]
            enum_id = int(el.attrib["enumerationType"], 16)
            if enum_id in enums:
                data["values"] = enums[enum_id]["values"]


def parse_machine_description(entries) -> dict:
    """Parse machine description XML into a dict."""
    description: dict = {}

    for el in entries:
        _prefix, _has_namespace, tag = el.tag.partition("}")
        if tag != "pairableDeviceTypes":
            description[tag] = el.text

    return description


def xml2json(features_xml: bytes, description_xml: bytes) -> dict:
    """Convert XML feature mapping and device description to JSON.

    Returns:
        Dict with 'description' and 'features' keys.
    """
    featuremapping = ET.fromstring(features_xml)
    description = ET.fromstring(description_xml)

    features: dict = {}
    errors: dict = {}
    enums: dict = {}

    # Features: all possible UIDs
    for child in featuremapping[1]:
        uid = int(child.attrib["refUID"], 16)
        name = child.text
        features[uid] = {"name": name}

    # Errors
    for child in featuremapping[2]:
        uid = int(child.attrib["refEID"], 16)
        name = child.text
        errors[uid] = name

    # Enums
    for child in featuremapping[3]:
        uid = int(child.attrib["refENID"], 16)
        values: dict = {}
        for v in child:
            value = int(v.attrib["refValue"])
            name = v.text
            values[value] = name
        enums[uid] = {
            "name": child.attrib["enumKey"],
            "values": values,
        }

    for i in range(4, 8):
        parse_xml_list(features, description[i], enums)

    # Remove duplicate uid field
    for uid in features:
        if "uid" in features[uid]:
            del features[uid]["uid"]

    return {
        "description": parse_machine_description(description[3]),
        "features": features,
    }
