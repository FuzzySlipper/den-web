#!/usr/bin/env bash
set -euo pipefail

tmp_json="$(mktemp)"
trap 'rm -f "$tmp_json"' EXIT

set +e
npx eslint "apps/**/*.{ts,tsx}" "packages/**/*.{ts,tsx}" --config harness/ci/eslint-complexity.config.js --format json > "$tmp_json"
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
guard = ownership["guards"]["function_complexity"]
baseline_path = ROOT / guard.get("baseline_file", "governance/complexity-baseline.json")
exception_doc = "governance/warning-exceptions.md#complexity-baseline-exceptions"
baseline = {}
if baseline_path.exists():
    baseline_config = json.loads(baseline_path.read_text())
    baseline = baseline_config.get("files", {})
    exception_doc = baseline_config.get("exception_doc", exception_doc)

tracked_rules = {"max-lines-per-function", "sonarjs/cognitive-complexity"}
current: dict[str, dict[str, int]] = defaultdict(lambda: defaultdict(int))
results = json.loads(eslint_json.read_text() or "[]")

for result in results:
    file_path = Path(result["filePath"])
    try:
        rel = file_path.relative_to(ROOT).as_posix()
    except ValueError:
        rel = file_path.as_posix()
    for message in result.get("messages", []):
        rule_id = message.get("ruleId")
        if rule_id in tracked_rules:
            current[rel][rule_id] += 1

failures: list[str] = []
documented_exception_count = 0

for rel, rules in sorted(current.items()):
    baseline_rules = baseline.get(rel, {})
    for rule_id, count in sorted(rules.items()):
        allowed = int(baseline_rules.get(rule_id, 0))
        if count > allowed:
            failures.append(f"FAIL: {rel} has {count} {rule_id} violations (baseline {allowed})")
        elif count:
            documented_exception_count += count

for rel, rules in sorted(baseline.items()):
    for rule_id, allowed in sorted(rules.items()):
        if current.get(rel, {}).get(rule_id, 0) == 0:
            failures.append(f"FAIL: {rel} cleared documented {rule_id} exception; remove it from governance/complexity-baseline.json")

if documented_exception_count:
    print(f"INFO: {documented_exception_count} documented complexity exception(s) remain; see {exception_doc}")

if failures:
    for failure in failures:
        print(failure, file=sys.stderr)
    sys.exit(1)

print("Complexity check passed.")
PY
