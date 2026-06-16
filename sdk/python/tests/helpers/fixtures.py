import json
from pathlib import Path

EXAMPLES_DIR = Path(__file__).resolve().parents[4] / "ufds-spec" / "examples"


def load_fixture(name: str):
    with (EXAMPLES_DIR / name).open("r", encoding="utf-8") as f:
        return json.load(f)
