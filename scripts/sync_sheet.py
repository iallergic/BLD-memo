#!/usr/bin/env python3
"""Refresh the public BLD letter-pair matrix for the GitHub Pages app.

The Google Sheet must allow link-based viewing (or be published to the web).
No Google credentials are stored in the website or this workflow.
"""
import csv
import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import Request, urlopen

LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWX"
SHEET_ID = "1iqJ1xnxOh2Y08bA-2tgthbDx8WgPcSs1EEclXlh24kg"
GID = "900428112"
CSV_URL = os.environ.get(
    "SHEET_CSV_URL",
    f"https://docs.google.com/spreadsheets/d/{SHEET_ID}/export?format=csv&gid={GID}",
)
OUTPUT = Path(__file__).resolve().parent.parent / "sheet-dictionary.json"


def main():
    request = Request(CSV_URL, headers={"User-Agent": "BLD-Memo-Sync/1.0"})
    with urlopen(request, timeout=30) as response:
        csv_text = response.read().decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(csv_text)))
    if len(rows) < 25 or rows[0][1:25] != list(LETTERS):
        raise ValueError(
            "Sheet CSV is unavailable or has an unexpected matrix layout. "
            "Make sure Google Sheets allows Anyone with the link to view."
        )

    pairs = {}
    for index, first in enumerate(LETTERS, start=1):
        row = rows[index]
        if len(row) < 25 or row[0] != first:
            raise ValueError(f"Unexpected or incomplete matrix row for {first}")
        for second, word in zip(LETTERS, row[1:25]):
            if not word.strip():
                raise ValueError(f"Empty association for {first}{second}")
            pairs[first + second] = word.strip()

    if len(pairs) != 576:
        raise ValueError("Expected exactly 576 letter pairs")

    if OUTPUT.exists():
        existing = json.loads(OUTPUT.read_text(encoding="utf-8"))
        if existing.get("pairs") == pairs:
            print("No changes to the Google Sheet dictionary")
            return

    snapshot = {
        "source": "Google Sheets",
        "spreadsheetId": SHEET_ID,
        "sheet": "Matrix",
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "pairs": pairs,
    }
    OUTPUT.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Updated sheet-dictionary.json with 576 letter pairs")


if __name__ == "__main__":
    main()
