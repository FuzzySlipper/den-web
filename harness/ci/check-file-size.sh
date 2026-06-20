#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    print("FAIL: Python 3.11+ is required for tomllib", file=sys.stderr)
    sys.exit(1)

ROOT = Path.cwd()
SOURCE_ROOTS = [
    ROOT / "apps" / "web" / "src",
    ROOT / "packages" / "shared" / "src",
    ROOT / "packages" / "ui" / "src",
    ROOT / "packages" / "api" / "src",
    ROOT / "packages" / "models" / "src",
    ROOT / "packages" / "features" / "src",
    ROOT / "packages" / "shell" / "src",
]
ownership = tomllib.loads((ROOT / "governance" / "ownership.toml").read_text())
guard = ownership["guards"]["file_size"]
warn_lines = int(guard["warn_lines"])
error_lines = int(guard["error_lines"])
mode = guard.get("phase1_mode", "strict")
baseline_path = ROOT / guard.get("baseline_file", "governance/file-size-baseline.json")
baseline = {}
if baseline_path.exists():
    baseline = json.loads(baseline_path.read_text()).get("files", {})
contract_exceptions = guard.get("contract_exceptions", {})

failures: list[str] = []
warnings: list[str] = []
infos: list[str] = []

for source_root in SOURCE_ROOTS:
    if not source_root.exists():
        continue
    for path in sorted(source_root.rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        name = path.name
        if ".test." in name or path.parts[-1].endswith(".d.ts"):
            continue
        rel = path.relative_to(ROOT).as_posix()
        lines = sum(1 for _ in path.open(encoding="utf-8"))
        if lines < warn_lines:
            continue

        contract_exception = contract_exceptions.get(rel)
        if contract_exception is not None:
            max_lines = int(contract_exception.get("max_lines", error_lines))
            reason = contract_exception.get("reason", "documented contract exception")
            if lines > max_lines:
                failures.append(f"FAIL: {rel} is {lines} lines (documented exception ceiling {max_lines})")
            else:
                infos.append(f"INFO: {rel} is {lines} lines (documented file-size exception: {reason})")
            continue

        baseline_lines = baseline.get(rel)
        if mode == "baseline_warn_only" and baseline_lines is not None:
            if lines > int(baseline_lines):
                failures.append(f"FAIL: {rel} grew from baseline {baseline_lines} to {lines} lines")
            else:
                warnings.append(f"WARN: {rel} is {lines} lines (Phase 1 baseline {baseline_lines}; clear in Phase 2/5)")
            continue

        if lines >= error_lines:
            failures.append(f"FAIL: {rel} is {lines} lines (limit {error_lines})")
        else:
            warnings.append(f"WARN: {rel} is {lines} lines (warning threshold {warn_lines})")

for warning in warnings:
    print(warning)
for info in infos:
    print(info)

if failures:
    for failure in failures:
        print(failure, file=sys.stderr)
    sys.exit(1)

print("File-size check passed.")
PY
