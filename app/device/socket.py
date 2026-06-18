#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
WebSocket connection to Bosch-Siemens Home Connect devices.

Supports both TLS/PSK (port 443) and HTTP/AES (port 80) connections.
"""

import json
import re
import socket
import ssl
import sys
from base64 import urlsafe_b64decode as base64url
from datetime import datetime
from typing import Optional

# Python 3.12 removed ssl.wrap_socket – restore it for sslpsk compatibility
if not hasattr(ssl, "wrap_socket"):
    def _wrap_socket_compat(sock, keyfile=None, certfile=None, server_side=False,
                            cert_reqs=ssl.CERT_NONE, ssl_version=ssl.PROTOCOL_TLS,
                            ca_certs=None, do_handshake_on_connect=True,
                            suppress_ragged_eofs=True, ciphers=None):
        ctx = ssl.SSLContext(ssl_version if ssl_version != ssl.PROTOCOL_TLS else ssl.PROTOCOL_TLS_CLIENT)
        ctx.check_hostname = False
        ctx.verify_mode = cert_reqs
        if ciphers:
            ctx.set_ciphers(ciphers)
        if certfile:
            ctx.load_cert_chain(certfile, keyfile)
        if ca_certs:
            ctx.load_verify_locations(ca_certs)
        return ctx.wrap_socket(sock, server_side=server_side,
                               do_handshake_on_connect=do_handshake_on_connect)
    ssl.wrap_socket = _wrap_socket_compat

try:
    from sslpsk3 import SSLPSKContext
    _HAS_SSLPSK_CONTEXT = True
except ImportError:
    _HAS_SSLPSK_CONTEXT = False

try:
    from sslpsk3 import wrap_socket as psk_wrap_socket
    _HAS_PSK_WRAP = True
except ImportError:
    _HAS_PSK_WRAP = False

if not _HAS_SSLPSK_CONTEXT and not _HAS_PSK_WRAP:
    try:
        import sslpsk
        psk_wrap_socket = sslpsk.wrap_socket
        _HAS_PSK_WRAP = True
    except ImportError:
        pass

import websocket
from Crypto.Cipher import AES
from Crypto.Hash import HMAC, SHA256
from Crypto.Random import get_random_bytes


def hmac(key: bytes, msg: bytes) -> bytes:
    """Compute HMAC-SHA256 on a message."""
    return HMAC.new(key, msg=msg, digestmod=SHA256).digest()


def now() -> str:
    """Current timestamp string."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")


class HCSocket:
    """WebSocket connection to a Home Connect device."""

    def __init__(self, host: str, psk64: str, iv64: Optional[str] = None):
        self.host = host
        self.psk = base64url(psk64 + "===")
        self.debug = False
        self.ws: Optional[websocket.WebSocket] = None

        if iv64:
            # HTTP self-encrypted socket
            self.http = True
            self.iv = base64url(iv64 + "===")
            self.enckey = hmac(self.psk, b"ENC")
            self.mackey = hmac(self.psk, b"MAC")
            self.port = 80
            self.uri = f"ws://{host}:80/homeconnect"
        else:
            self.http = False
            self.iv = b""
            self.enckey = b""
            self.mackey = b""
            self.port = 443
            self.uri = f"wss://{host}:443/homeconnect"

        # Encryption state (initialized in reset)
        self.last_rx_hmac = bytes(16)
        self.last_tx_hmac = bytes(16)
        self.aes_encrypt: Optional[AES] = None  # type: ignore[type-arg]
        self.aes_decrypt: Optional[AES] = None  # type: ignore[type-arg]

    def reset(self) -> None:
        """Restore encryption state for a fresh connection (HTTP mode only)."""
        if not self.http:
            return
        self.last_rx_hmac = bytes(16)
        self.last_tx_hmac = bytes(16)
        self.aes_encrypt = AES.new(self.enckey, AES.MODE_CBC, self.iv)
        self.aes_decrypt = AES.new(self.enckey, AES.MODE_CBC, self.iv)

    def hmac_msg(self, direction: bytes, enc_msg: bytes) -> bytes:
        """HMAC an inbound or outbound message, chaining the last HMAC."""
        hmac_input = self.iv + direction + enc_msg
        return hmac(self.mackey, hmac_input)[0:16]

    def decrypt(self, buf: bytes) -> Optional[bytes]:
        """Decrypt an incoming message."""
        if len(buf) < 32:
            print(f"{__name__}: Short message? {buf.hex()}", file=sys.stderr)
            return None
        if len(buf) % 16 != 0:
            print(f"{__name__}: Unaligned message? {buf.hex()}", file=sys.stderr)

        enc_msg = buf[:-16]
        their_hmac = buf[-16:]

        our_hmac = self.hmac_msg(b"\x43" + self.last_rx_hmac, enc_msg)
        if their_hmac != our_hmac:
            print(f"{__name__}: HMAC failure", file=sys.stderr)
            return None

        self.last_rx_hmac = their_hmac

        if self.aes_decrypt is None:
            return None
        msg = self.aes_decrypt.decrypt(enc_msg)

        pad_len = msg[-1]
        if len(msg) < pad_len:
            print(f"{__name__}: padding error? {msg.hex()}", file=sys.stderr)
            return None

        return msg[:-pad_len]

    def encrypt(self, clear_msg: str) -> bytes:
        """Encrypt an outgoing message."""
        clear_bytes = bytes(clear_msg, "utf-8")

        pad_len = 16 - (len(clear_bytes) % 16)
        if pad_len == 1:
            pad_len += 16
        pad = b"\x00" + get_random_bytes(pad_len - 2) + bytearray([pad_len])
        clear_bytes = clear_bytes + pad

        if self.aes_encrypt is None:
            raise RuntimeError("Encryption not initialized")
        enc_msg = self.aes_encrypt.encrypt(clear_bytes)

        self.last_tx_hmac = self.hmac_msg(b"\x45" + self.last_tx_hmac, enc_msg)

        return enc_msg + self.last_tx_hmac

    def reconnect(self) -> None:
        """Establish or re-establish the WebSocket connection."""
        self.reset()
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)
        sock.connect((self.host, self.port))

        # TCP Keepalive to prevent connection drops
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)
        if sys.platform.startswith("linux"):
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPIDLE, 30)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPINTVL, 10)
            sock.setsockopt(socket.IPPROTO_TCP, socket.TCP_KEEPCNT, 3)
        elif sys.platform == "darwin":
            TCP_KEEPALIVE = 0x10
            sock.setsockopt(socket.IPPROTO_TCP, TCP_KEEPALIVE, 30)

        if not self.http:
            psk = self.psk
            # PSK identity as used by the Home Connect app
            psk_identity = "HCCOM_Local_App"
            connected = False

            # Method 0: Python 3.13+ native TLS-PSK
            if not connected and hasattr(ssl, "HAS_PSK") and ssl.HAS_PSK:
                try:
                    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    ctx.maximum_version = ssl.TLSVersion.TLSv1_2
                    ctx.set_ciphers("PSK")
                    ctx.set_psk_client_callback(lambda hint: (psk_identity, psk))
                    sock = ctx.wrap_socket(sock, server_hostname=self.host)  # type: ignore[assignment]
                    connected = True
                except Exception:
                    pass

            # Method 1: sslpsk3 SSLPSKContext
            if not connected and _HAS_SSLPSK_CONTEXT:
                try:
                    ctx = SSLPSKContext(ssl.PROTOCOL_TLS_CLIENT)
                    ctx.check_hostname = False
                    ctx.verify_mode = ssl.CERT_NONE
                    ctx.set_ciphers("ECDHE-PSK-CHACHA20-POLY1305")
                    ctx.maximum_version = ssl.TLSVersion.TLSv1_2
                    ctx.set_psk_client_callback(lambda hint: (psk_identity, psk))
                    sock = ctx.wrap_socket(sock, server_hostname=self.host)  # type: ignore[assignment]
                    connected = True
                except Exception:
                    pass

            # Method 2: sslpsk3/sslpsk wrap_socket (backward compatible)
            if not connected and _HAS_PSK_WRAP:
                try:
                    sock = psk_wrap_socket(  # type: ignore[assignment]
                        sock,
                        psk=psk,
                        ciphers="ECDHE-PSK-CHACHA20-POLY1305",
                        server_hostname=self.host,
                    )
                    connected = True
                except TypeError:
                    sock = psk_wrap_socket(  # type: ignore[assignment]
                        sock,
                        ssl_version=ssl.PROTOCOL_TLSv1_2,
                        ciphers="ECDHE-PSK-CHACHA20-POLY1305",
                        psk=psk,
                    )
                    connected = True

            if not connected:
                raise RuntimeError("No PSK-TLS library available (install sslpsk3)")

        self.ws = websocket.WebSocket()
        self.ws.settimeout(30)
        self.ws.connect(self.uri, socket=sock, origin="")

    def send(self, msg: dict) -> None:
        """Send a JSON message to the device."""
        if self.ws is None:
            raise RuntimeError("WebSocket not connected")
        buf = json.dumps(msg, separators=(",", ":"))
        buf = re.sub("'", '"', buf)
        if self.debug:
            print(now(), __name__, "TX:", buf)
        if self.http:
            self.ws.send_binary(self.encrypt(buf))
        else:
            self.ws.send(buf)

    def recv(self) -> Optional[bytes]:
        """Receive a message from the device."""
        if self.ws is None:
            return None
        buf = self.ws.recv()
        if buf is None or buf == "":
            return None

        if self.http:
            buf = self.decrypt(buf)
        if buf is None:
            return None

        if self.debug:
            print(now(), __name__, "RX:", buf)
        return buf
