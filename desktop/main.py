# SPDX-License-Identifier: GPL-3.0-or-later
"""exit 0 - free practice for LPI Linux Essentials 010-160 (desktop app).

Opens the web app in docs/ inside a native window (Edge WebView2 on Windows).
Progress is kept in the user's profile so it survives updates:
  Windows: %APPDATA%\\Exit0
  Linux:   ~/.local/share/exit0

Run from source:   pip install -r desktop/requirements.txt && python desktop/main.py
Build (Windows):   see .github/workflows/release.yml
"""
import os
import socket
import sys

import webview

APP_NAME = "exit 0 · Linux Essentials practice"
PORTS = range(47010, 47020)   # fixed port keeps the same storage origin between runs


def resource_root():
    """Folder that contains docs/ (PyInstaller unpacks to sys._MEIPASS)."""
    if hasattr(sys, "_MEIPASS"):
        return sys._MEIPASS
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def data_dir():
    if sys.platform.startswith("win"):
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        path = os.path.join(base, "Exit0")
    elif sys.platform == "darwin":
        path = os.path.expanduser("~/Library/Application Support/Exit0")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.expanduser("~/.local/share")
        path = os.path.join(base, "exit0")
    os.makedirs(path, exist_ok=True)
    return path


def free_port():
    for port in PORTS:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    return None   # let pywebview pick a random port as a last resort


def main():
    root = resource_root()
    index = os.path.join(root, "docs", "index.html")
    icon = os.path.join(root, "icon.ico") if sys.platform.startswith("win") else None
    webview.create_window(APP_NAME, index, width=1240, height=840, min_size=(720, 560),
                          background_color="#F6F7F5", text_select=True)
    webview.start(http_server=True, http_port=free_port(), private_mode=False,
                  storage_path=data_dir(), icon=icon)


if __name__ == "__main__":
    main()
