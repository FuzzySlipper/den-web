#!/usr/bin/env bash
set -euo pipefail

tmp_json="$(mktemp)"
trap 'rm -f "$tmp_json"' EXIT

set +e
npx eslint . --format json > "$tmp_json"
eslint_status=$?
set -e

python3 - "$tmp_json" <<'PY'
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    print("FAIL: Python 3.11+ is required for tomllib", file=sys.stderr)
    sys.exit(1)

ROOT = Path.cwd()
eslint_json = Path(sys.argv[1])
ownership = tomllib.loads((ROOT / "governance" / "ownership.toml").read_text())
guard = ownership["guards"]["lint"]
baseline_path = ROOT / guard.get("baseline_file", "governance/lint-baseline.json")
baseline = {}
if baseline_path.exists():
    baseline = json.loads(baseline_path.read_text()).get("files", {})

current: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
results = json.loads(eslint_json.read_text() or "[]")

for result in results:
    file_path = Path(result["filePath"])
    try:
        rel = file_path.relative_to(ROOT).as_posix()
    except ValueError:
        rel = file_path.as_posix()
    for message in result.get("messages", []):
        rule_id = message.get("ruleId") or "eslint/parser"
        current[rel][rule_id] += 1

failures: list[str] = []
warnings: list[str] = []

for rel, rules in sorted(current.items()):
    baseline_rules = baseline.get(rel, {})
    for rule_id, count in sorted(rules.items()):
        allowed = int(baseline_rules.get(rule_id, 0))
        if count > allowed:
            failures.append(f"FAIL: {rel} has {count} {rule_id} lint issue(s) (baseline {allowed})")
        elif count:
            warnings.append(f"WARN: {rel} has {count} baseline {rule_id} lint issue(s)")

for rel, rules in sorted(baseline.items()):
    for rule_id, allowed in sorted(rules.items()):
        if current.get(rel, {}).get(rule_id, 0) == 0:
            warnings.append(f"WARN: {rel} cleared baseline {rule_id}; remove it from governance/lint-baseline.json")

for warning in warnings:
    print(warning)

if failures:
    for failure in failures:
        print(failure, file=sys.stderr)
    sys.exit(1)

print("Lint baseline check passed.")
PY
