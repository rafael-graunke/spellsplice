#!/usr/bin/env python3
"""Spellsplice live-mode relay server.

Relays WebSocket messages between the Spellsplice controller and the
OBS browser-source overlay. No dependencies beyond the Python standard
library - just run:

    python3 spellsplice-relay.py [port]

Default port is 8765. Binds to 127.0.0.1 only, so the controller and
OBS's Browser Source must run on this same machine. Point both the
Connection tab's WebSocket URL and OBS's Browser Source at
ws://localhost:<port>.
"""

import base64
import hashlib
import socket
import struct
import sys
import threading

WS_MAGIC = b'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
DEFAULT_PORT = 8765

clients_lock = threading.Lock()
clients = set()


def recv_exact(conn, n):
    buf = b''
    while len(buf) < n:
        chunk = conn.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def handshake(conn):
    data = b''
    while b'\r\n\r\n' not in data:
        chunk = conn.recv(4096)
        if not chunk:
            return False
        data += chunk

    headers = {}
    for line in data.split(b'\r\n')[1:]:
        if b':' in line:
            k, v = line.split(b':', 1)
            headers[k.strip().lower()] = v.strip()

    key = headers.get(b'sec-websocket-key')
    if not key:
        return False

    accept = base64.b64encode(hashlib.sha1(key + WS_MAGIC).digest())
    response = (
        b'HTTP/1.1 101 Switching Protocols\r\n'
        b'Upgrade: websocket\r\n'
        b'Connection: Upgrade\r\n'
        b'Sec-WebSocket-Accept: ' + accept + b'\r\n\r\n'
    )
    conn.sendall(response)
    return True


def read_frame(conn):
    header = recv_exact(conn, 2)
    if header is None:
        return None, None
    b1, b2 = header[0], header[1]
    opcode = b1 & 0x0F
    masked = b2 & 0x80
    length = b2 & 0x7F

    if length == 126:
        ext = recv_exact(conn, 2)
        if ext is None:
            return None, None
        length = struct.unpack('!H', ext)[0]
    elif length == 127:
        ext = recv_exact(conn, 8)
        if ext is None:
            return None, None
        length = struct.unpack('!Q', ext)[0]

    mask_key = recv_exact(conn, 4) if masked else None
    payload = recv_exact(conn, length) if length else b''
    if payload is None:
        return None, None

    if masked and mask_key:
        payload = bytes(b ^ mask_key[i % 4] for i, b in enumerate(payload))

    return opcode, payload


def send_frame(conn, payload, opcode=0x1):
    length = len(payload)
    header = bytes([0x80 | opcode])
    if length <= 125:
        header += bytes([length])
    elif length <= 0xFFFF:
        header += bytes([126]) + struct.pack('!H', length)
    else:
        header += bytes([127]) + struct.pack('!Q', length)
    conn.sendall(header + payload)


def drop(conn):
    with clients_lock:
        clients.discard(conn)
    try:
        conn.close()
    except OSError:
        pass


def broadcast(sender, payload):
    with clients_lock:
        targets = [c for c in clients if c is not sender]
    for c in targets:
        try:
            send_frame(c, payload, opcode=0x1)
        except OSError:
            drop(c)


def handle_client(conn, addr):
    if not handshake(conn):
        conn.close()
        return

    with clients_lock:
        clients.add(conn)
    print(f'[+] {addr[0]}:{addr[1]} connected ({len(clients)} total)')

    try:
        while True:
            opcode, payload = read_frame(conn)
            if opcode is None or opcode == 0x8:  # EOF or close
                break
            if opcode == 0x9:  # ping
                send_frame(conn, payload, opcode=0xA)
                continue
            if opcode in (0x1, 0x2):  # text/binary
                broadcast(conn, payload)
    except (ConnectionResetError, OSError):
        pass
    finally:
        drop(conn)
        print(f'[-] {addr[0]}:{addr[1]} disconnected ({len(clients)} total)')


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT

    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('127.0.0.1', port))
    server.listen(8)

    print(f'Spellsplice relay listening on ws://localhost:{port}')
    print('  Controller and OBS must run on this machine.')
    print('Ctrl+C to stop.')

    try:
        while True:
            conn, addr = server.accept()
            threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()
    except KeyboardInterrupt:
        print('\nShutting down.')
    finally:
        server.close()


if __name__ == '__main__':
    main()
