#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from __future__ import annotations

import re
import sys
from collections import defaultdict
from pathlib import Path

try:
    import tomllib
except ModuleNotFoundError:  # pragma: no cover
    print("FAIL: Python 3.11+ is required for tomllib", file=sys.stderr)
    sys.exit(1)

ROOT = Path.cwd()
OWNERSHIP = ROOT / "governance" / "ownership.toml"
SOURCE_ROOTS = [
    ROOT / "apps" / "web" / "src",
    ROOT / "packages" / "shared" / "src",
    ROOT / "packages" / "ui" / "src",
    ROOT / "packages" / "api" / "src",
    ROOT / "packages" / "models" / "src",
    ROOT / "packages" / "features" / "src",
    ROOT / "packages" / "shell" / "src",
]

data = tomllib.loads(OWNERSHIP.read_text())
layers = data["layers"]
expected_models = set(data.get("expected_violations", {}).get("model_files_in_features", []))
expected_shared = set(data.get("expected_violations", {}).get("shared_utilities_in_features", []))

IMPORT_RE = re.compile(r"""(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)""")

EXTS = ("", ".ts", ".tsx", ".js", ".jsx")
INDEXES = tuple(f"/index{ext}" for ext in EXTS if ext)
ALIASES = {
    "@den-web/api": ROOT / "packages" / "api" / "src",
    "@den-web/features": ROOT / "packages" / "features" / "src",
    "@den-web/models": ROOT / "packages" / "models" / "src",
    "@den-web/shared": ROOT / "packages" / "shared" / "src",
    "@den-web/shell": ROOT / "packages" / "shell" / "src",
    "@den-web/ui": ROOT / "packages" / "ui" / "src",
}


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def is_source(path: Path) -> bool:
    ignored = {"node_modules", "dist"}
    return path.suffix in {".ts", ".tsx"} and not ignored.intersection(path.parts)


def source_files() -> list[Path]:
    files: list[Path] = []
    for source_root in SOURCE_ROOTS:
        if source_root.exists():
            files.extend(path for path in source_root.rglob("*") if is_source(path))
    return sorted(files)


def feature_name(path: Path) -> str | None:
    parts = path.relative_to(ROOT).parts
    if len(parts) >= 4 and parts[:3] == ("packages", "features", "src"):
        return parts[3]
    return None


def classify(path: Path) -> tuple[str, str]:
    r = rel(path)
    if r in expected_models:
        return "transform", "expected model file currently in feature folder"
    if r in expected_shared:
        return "foundation", "expected shared utility currently in feature folder"
    if r.startswith("packages/shared/src/"):
        return "foundation", "shared"
    if r.startswith("packages/ui/src/hooks/"):
        return "browser_foundation", "ui hooks"
    if r.startswith("packages/ui/src/"):
        return "presentation", "ui"
    if r.startswith("packages/api/src/"):
        return "data", "api"
    if r.startswith("packages/models/src/"):
        return "transform", "models"
    if r.startswith("packages/features/src/"):
        return "composition", "feature"
    if r.startswith("packages/shell/src/"):
        return "bootstrap", "shell"
    if r.startswith("apps/web/src/"):
        return "app", "app"
    return "composition", "unclassified source"


def resolve_candidate(base: Path) -> Path | None:
    candidates: list[Path] = []
    for ext in EXTS:
        candidates.append(Path(str(base) + ext))
    for suffix in INDEXES:
        candidates.append(Path(str(base) + suffix))
    for candidate in candidates:
        if candidate.exists() and candidate.is_file() and candidate.is_relative_to(ROOT):
            return candidate
    return None


def resolve_relative(source: Path, spec: str) -> Path | None:
    if not spec.startswith("."):
        return None
    return resolve_candidate((source.parent / spec).resolve())


def resolve_alias(spec: str) -> Path | None:
    for alias, root in sorted(ALIASES.items(), key=lambda item: -len(item[0])):
        if spec == alias:
            return resolve_candidate(root / "index")
        if spec.startswith(alias + "/"):
            suffix = spec[len(alias):].lstrip("/")
            return resolve_candidate(root / suffix)
    return None


def internal_target(source: Path, spec: str) -> Path | None:
    if spec.startswith("."):
        return resolve_relative(source, spec)
    if spec.startswith("@den-web/"):
        return resolve_alias(spec)
    return None


def imports_for(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8")
    specs: list[str] = []
    for match in IMPORT_RE.finditer(text):
        specs.append(match.group(1) or match.group(2))
    return specs


failures: list[str] = []
warnings: list[str] = []
feature_edges: dict[str, set[str]] = defaultdict(set)

for path in source_files():
    r = rel(path)
    source_layer, _source_note = classify(path)
    source_rank = layers[source_layer]

    if r in expected_models:
        warnings.append(f"WARN: expected model-layer violation remains for Phase 2: {r}")
    if r in expected_shared:
        warnings.append(f"WARN: expected shared-utility violation remains for Phase 2: {r}")

    for spec in imports_for(path):
        if spec in {"react", "react-dom"} or spec.startswith("react/") or spec.startswith("react-dom/"):
            if source_layer in {"foundation", "data", "transform"}:
                failures.append(f"FAIL: {r} imports '{spec}' - {source_layer} layer must not depend on React")
            continue

        target = internal_target(path, spec)
        if target is None or not is_source(target):
            continue

        target_layer, _target_note = classify(target)
        target_rank = layers[target_layer]

        source_feature = feature_name(path)
        target_feature = feature_name(target)
        if source_feature and target_feature and source_feature != target_feature:
            feature_edges[source_feature].add(target_feature)

        if r in expected_models or r in expected_shared:
            continue

        if source_layer == "composition" and target_layer == "composition":
            continue

        if source_rank < target_rank:
            failures.append(
                f"FAIL: {r} imports '{spec}' ({rel(target)}) - {source_layer} layer must not import upward into {target_layer}"
            )


def cycle(edges: dict[str, set[str]]) -> list[str] | None:
    visiting: set[str] = set()
    visited: set[str] = set()
    stack: list[str] = []

    def dfs(node: str) -> list[str] | None:
        visiting.add(node)
        stack.append(node)
        for nxt in sorted(edges.get(node, ())):
            if nxt in visiting:
                start = stack.index(nxt)
                return stack[start:] + [nxt]
            if nxt not in visited:
                found = dfs(nxt)
                if found:
                    return found
        visiting.remove(node)
        visited.add(node)
        stack.pop()
        return None

    for node in sorted(edges):
        if node not in visited:
            found = dfs(node)
            if found:
                return found
    return None


found_cycle = cycle(feature_edges)
if found_cycle:
    failures.append("FAIL: feature import cycle detected: " + " -> ".join(found_cycle))

for warning in sorted(set(warnings)):
    print(warning)

if failures:
    for failure in failures:
        print(failure, file=sys.stderr)
    sys.exit(1)

print("Dependency governance check passed.")
if feature_edges:
    edge_text = ", ".join(f"{src}->{dst}" for src in sorted(feature_edges) for dst in sorted(feature_edges[src]))
    print(f"Feature DAG edges: {edge_text}")
PY
