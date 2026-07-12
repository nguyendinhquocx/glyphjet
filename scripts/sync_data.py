"""sync_data.py — copy data.json from the upstream web project and verify count.

This is a maintainer script. Point GLYPHJET_WEB_DATA (env var or first arg)
at your local checkout of the icon.quoc.app web project's data.json.

Usage:
    py -3.13 scripts/sync_data.py
    GLYPHJET_WEB_DATA=/path/to/data.json py -3.13 scripts/sync_data.py
"""
from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB_DATA = Path(
    os.environ.get("GLYPHJET_WEB_DATA")
    or r"D:/pcloud/workspace/code/website/icon/public/data.json"
)
LOCAL_DATA = ROOT / "src" / "data.json"

EXPECTED_COUNT = 14870


def main() -> int:
    if not WEB_DATA.exists():
        print(f"ERROR: web data.json not found at {WEB_DATA}", file=sys.stderr)
        return 1
    shutil.copyfile(WEB_DATA, LOCAL_DATA)
    data = json.loads(LOCAL_DATA.read_text(encoding="utf-8"))
    actual = len(data)
    if actual != EXPECTED_COUNT:
        print(
            f"WARN: item count {actual} differs from expected {EXPECTED_COUNT}",
            file=sys.stderr,
        )
    print(f"OK: synced {LOCAL_DATA} ({actual} items)")
    print("Run `pnpm build:taxonomy` after sync to refresh taxonomy.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
