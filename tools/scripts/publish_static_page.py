#!/usr/bin/env python3
"""Publish standalone static HTML/Markdown artifacts under pages/.

This is intentionally simple: it copies one or more source artifacts into a
shareable `pages/<slug>/` directory, renders Markdown sources to HTML, updates a
`pages/index.html` landing page, and can optionally commit/push the result.

GitHub Pages setup this expects:
  .github/workflows/pages.yml deploys the tracked `pages/` directory as the
  Pages artifact. Locally, sources live in `pages/<slug>/`; publicly, that page
  is served from the site root as:
  https://<owner>.github.io/<repo>/<slug>/
"""

from __future__ import annotations

import argparse
import datetime as dt
import html
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
PAGES_DIR = ROOT / "pages"
MANIFEST = PAGES_DIR / "pages-manifest.json"
STYLE = PAGES_DIR / "assets" / "page-style.css"
STYLE_CSS = """:root {
  color-scheme: light dark;
  --bg:#101217;
  --panel:#181c24;
  --panel-2:#202636;
  --text:#f3f5f7;
  --muted:#aeb6c2;
  --line:#303747;
  --accent:#a78bfa;
  --code:#0b0d12;
  --shadow: 0 18px 40px rgb(0 0 0 / 0.24);
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }
body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.55 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overflow-wrap: anywhere; }
a { color: var(--accent); text-underline-offset: 0.18em; }
.site-shell { max-width: 1180px; margin: 0 auto; padding: 28px 18px 64px; }
.site-header { border-bottom: 1px solid var(--line); margin-bottom: 24px; padding-bottom: 18px; }
.crumb { color: var(--muted); font-size: 0.9rem; margin-bottom: 8px; }
h1, h2, h3 { line-height: 1.18; overflow-wrap: anywhere; }
h1 { margin: 0 0 10px; font-size: clamp(2rem, 5vw, 3.4rem); }
h2 { margin-top: 2rem; }
.summary { color: var(--muted); font-size: 1.08rem; max-width: 80ch; }
.card-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); }
.card, .navbox { background: var(--panel); border: 1px solid var(--line); border-radius: 14px; padding: 16px; }
.card h2, .card h3 { margin-top: 0; }
.navbox { margin: 18px 0 24px; }
.navbox ul { margin: 8px 0 0; padding-left: 22px; }
.table-scroll { border: 1px solid var(--line); border-radius: 12px; box-shadow: var(--shadow); margin: 18px 0; max-width: 100%; overflow-x: auto; overscroll-behavior-inline: contain; -webkit-overflow-scrolling: touch; }
.table-scroll:focus { outline: 2px solid var(--accent); outline-offset: 3px; }
.table-scroll table { margin: 0; }
table { border-collapse: separate; border-spacing: 0; width: 100%; }
th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 7px 9px; text-align: left; vertical-align: top; }
th:first-child, td:first-child { border-left: 0; }
th:last-child, td:last-child { border-right: 0; }
tr:last-child td { border-bottom: 0; }
th { background: var(--panel-2); position: sticky; top: 0; z-index: 1; }
pre, code { background: var(--code); border-radius: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
code { padding: 0.12em 0.25em; word-break: break-word; }
pre { overflow: auto; padding: 14px; white-space: pre-wrap; }
blockquote { border-left: 4px solid var(--line); color: var(--muted); margin-left: 0; padding-left: 14px; }
details { border: 1px solid var(--line); border-radius: 10px; margin: 12px 0; padding: 10px 12px; }
summary { cursor: pointer; }
.meta { color: var(--muted); font-size: 0.9rem; }

@media (max-width: 760px) {
  body { font-size: 15px; line-height: 1.5; }
  .site-shell { padding: 18px 10px 42px; }
  .site-header { margin-bottom: 18px; padding-bottom: 14px; }
  h1 { font-size: clamp(1.65rem, 9vw, 2.25rem); }
  h2 { font-size: 1.28rem; }
  h3 { font-size: 1.08rem; }
  .summary { font-size: 1rem; }
  .card, .navbox { border-radius: 12px; padding: 12px; }
  .navbox ul { padding-left: 18px; }
  .table-scroll { margin-left: -10px; margin-right: -10px; border-left: 0; border-right: 0; border-radius: 0; box-shadow: none; }
  .table-scroll::before { content: "Swipe table →"; display: block; color: var(--muted); font-size: 0.78rem; letter-spacing: 0.02em; padding: 7px 10px; text-transform: uppercase; }
  table { min-width: 980px; font-size: 0.86rem; }
  th, td { padding: 6px 7px; }
  th:not(:first-child):not(:last-child), td:not(:first-child):not(:last-child) { white-space: nowrap; }
  th:first-child, td:first-child { background: var(--panel); box-shadow: 1px 0 0 var(--line); left: 0; max-width: 42vw; min-width: 9rem; position: sticky; white-space: normal; z-index: 2; }
  th:first-child { background: var(--panel-2); z-index: 3; }
  td:last-child, th:last-child { min-width: 18rem; white-space: normal; }
  pre { margin-left: -10px; margin-right: -10px; border-radius: 0; font-size: 0.82rem; }
}
"""



def main() -> int:
    args = parse_args()
    slug = slugify(args.slug or args.title)
    if not slug:
        raise SystemExit("slug/title produced an empty slug")

    sources = [Path(src).expanduser().resolve() for src in args.source]
    missing = [str(src) for src in sources if not src.exists()]
    if missing:
        raise SystemExit(f"source file(s) not found: {', '.join(missing)}")

    page_dir = PAGES_DIR / slug
    source_dir = page_dir / "source"
    page_dir.mkdir(parents=True, exist_ok=True)
    source_dir.mkdir(parents=True, exist_ok=True)
    ensure_site_assets()

    rendered_files: list[dict[str, str]] = []
    used_source_names: set[str] = set()
    used_html_names: set[str] = {"index.html"}
    for index, src in enumerate(sources):
        source_name = unique_name(src.name, used_source_names)
        copied_source = source_dir / source_name
        if src != copied_source:
            shutil.copy2(src, copied_source)
        html_name = "index.html" if index == 0 else unique_name(f"{src.stem}.html", used_html_names)
        out_html = page_dir / html_name
        if src.suffix.lower() in {".html", ".htm"}:
            raw = src.read_text(encoding="utf-8", errors="replace")
            body = raw if looks_like_full_html(raw) else wrap_html(args.title, raw, summary=args.summary)
            out_html.write_text(body, encoding="utf-8")
        elif src.suffix.lower() in {".md", ".markdown", ".txt"}:
            markdown_text = src.read_text(encoding="utf-8", errors="replace")
            rendered = render_markdown(markdown_text)
            out_html.write_text(wrap_html(args.title, rendered, summary=args.summary), encoding="utf-8")
        else:
            # Unknown source type: copy and link it; create a tiny landing wrapper.
            out_html.write_text(
                wrap_html(
                    args.title,
                    f'<p><a href="source/{html.escape(src.name)}">Download {html.escape(src.name)}</a></p>',
                    summary=args.summary,
                ),
                encoding="utf-8",
            )
        rendered_files.append({"source": f"source/{source_name}", "html": html_name, "title": title_from_name(src)})

    # If the first source became index.html, add links to every rendered sibling/source.
    write_page_nav(page_dir / "index.html", args.title, args.summary, rendered_files)

    manifest = load_manifest()
    entry = {
        "slug": slug,
        "title": args.title,
        "summary": args.summary,
        "created_at": args.created_at or now_iso(),
        "updated_at": now_iso(),
        "files": rendered_files,
    }
    manifest = [item for item in manifest if item.get("slug") != slug]
    manifest.append(entry)
    manifest.sort(key=lambda item: item.get("updated_at", ""), reverse=True)
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    write_landing_index(manifest)

    repo_url = f"pages/{slug}/"
    site_url = f"{slug}/"
    print(f"Published local static page: {page_dir}")
    print(f"Repository-relative path: {repo_url}")
    if args.public_base_url:
        print(f"Public URL: {args.public_base_url.rstrip('/')}/{site_url}")

    if args.git_commit or args.git_push:
        commit_pages(slug, args.commit_message or f"Publish static page: {args.title}", push=args.git_push)

    return 0


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Publish HTML/Markdown artifacts under pages/ for GitHub Pages.")
    ap.add_argument("--title", required=True, help="Human title shown in indexes and page chrome")
    ap.add_argument("--slug", default="", help="URL slug under pages/; defaults to slugified title")
    ap.add_argument("--summary", default="", help="Short description shown on pages/index.html")
    ap.add_argument("--source", action="append", required=True, help="Source artifact to publish; repeat for multiple files")
    ap.add_argument("--created-at", default="", help="Optional ISO timestamp for stable recreated entries")
    ap.add_argument("--public-base-url", default="", help="Optional base URL to print, e.g. https://user.github.io/repo/")
    ap.add_argument("--git-commit", action="store_true", help="git add pages/ and commit")
    ap.add_argument("--git-push", action="store_true", help="also push after committing; implies --git-commit")
    ap.add_argument("--commit-message", default="", help="commit message for --git-commit")
    return ap.parse_args()


def ensure_site_assets() -> None:
    (PAGES_DIR / "assets").mkdir(parents=True, exist_ok=True)
    if not STYLE.exists():
        STYLE.write_text(STYLE_CSS, encoding="utf-8")
    nojekyll = PAGES_DIR / ".nojekyll"
    if not nojekyll.exists():
        nojekyll.write_text("", encoding="utf-8")


def load_manifest() -> list[dict[str, Any]]:
    if not MANIFEST.exists():
        return []
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except Exception:
        return []
    return data if isinstance(data, list) else []


def write_landing_index(manifest: list[dict[str, Any]]) -> None:
    cards = []
    for item in manifest:
        slug = html.escape(str(item.get("slug", "")))
        title = html.escape(str(item.get("title", slug)))
        summary = html.escape(str(item.get("summary", "")))
        updated = html.escape(str(item.get("updated_at", "")))
        cards.append(
            f'<article class="card"><h2><a href="{slug}/">{title}</a></h2>'
            f'<p>{summary}</p><p class="meta">Updated {updated}</p></article>'
        )
    body = '<div class="card-grid">' + "\n".join(cards) + '</div>' if cards else '<p>No pages published yet.</p>'
    (PAGES_DIR / "index.html").write_text(
        wrap_html("Patch's Shared Pages", body, summary="Shareable static reports and Den document exports.", style_href="assets/page-style.css"),
        encoding="utf-8",
    )


def write_page_nav(index_path: Path, title: str, summary: str, files: list[dict[str, str]]) -> None:
    current = index_path.read_text(encoding="utf-8", errors="replace")
    links = ['<div class="navbox"><strong>Files in this share</strong><ul>']
    for file in files:
        label = html.escape(file["title"])
        links.append(
            f'<li><a href="{html.escape(file["html"])}">{label}</a> '
            f'(<a href="{html.escape(file["source"])}">source</a>)</li>'
        )
    links.append('</ul></div>')
    nav = "\n".join(links)
    marker = '<main class="site-content">'
    if marker in current:
        current = current.replace(marker, marker + "\n" + nav, 1)
    else:
        current = wrap_html(title, nav + current, summary=summary)
    index_path.write_text(current, encoding="utf-8")


def render_markdown(markdown_text: str) -> str:
    try:
        import markdown  # type: ignore

        rendered = markdown.markdown(
            markdown_text,
            extensions=["extra", "fenced_code", "tables", "toc", "sane_lists"],
            output_format="html",
        )
        return sanitize_rendered_html(rendered)
    except Exception:
        return fallback_markdown(markdown_text)


def sanitize_rendered_html(rendered: str) -> str:
    """Small sanitizer for public pages containing model-generated text.

    Python-Markdown intentionally allows raw HTML. These reports may contain model
    output, so strip active content while preserving harmless report structure such
    as tables, details/summary, links, code blocks, and line breaks.
    """
    rendered = re.sub(r"<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*>.*?<\s*/\s*\1\s*>", "", rendered, flags=re.I | re.S)
    rendered = re.sub(r"<\s*(script|style|iframe|object|embed|svg|math)\b[^>]*?/?>", "", rendered, flags=re.I)
    rendered = re.sub(r"\s+on[a-zA-Z0-9_-]+\s*=\s*(\"[^\"]*\"|'[^']*'|[^\s>]+)", "", rendered)
    rendered = re.sub(r"\s+(href|src)\s*=\s*(['\"])\s*javascript:[^'\"]*\2", r' \1="#"', rendered, flags=re.I)
    return wrap_tables(rendered)


def wrap_tables(rendered: str) -> str:
    """Wrap rendered Markdown tables in a mobile-scroll container.

    Python-Markdown emits bare ``<table>`` nodes. They are readable on desktop,
    but benchmark reports have many wide model-comparison tables that are painful
    on a phone. A lightweight wrapper gives mobile browsers a clear horizontal
    scroll region without altering the source Markdown.
    """
    return re.sub(
        r"(?<!<div class=\"table-scroll\" tabindex=\"0\" role=\"region\" aria-label=\"Scrollable table\">\n)(<table>.*?</table>)",
        r'<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table">\n\1\n</div>',
        rendered,
        flags=re.S,
    )


def fallback_markdown(text: str) -> str:
    blocks: list[str] = []
    in_code = False
    code_lines: list[str] = []
    para: list[str] = []

    def flush_para() -> None:
        if para:
            blocks.append(f"<p>{html.escape(' '.join(para))}</p>")
            para.clear()

    for line in text.splitlines():
        if line.startswith("```"):
            if in_code:
                blocks.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
                code_lines.clear()
                in_code = False
            else:
                flush_para()
                in_code = True
            continue
        if in_code:
            code_lines.append(line)
            continue
        stripped = line.strip()
        if not stripped:
            flush_para()
            continue
        if stripped.startswith("#"):
            flush_para()
            level = min(len(stripped) - len(stripped.lstrip("#")), 6)
            content = stripped[level:].strip()
            blocks.append(f"<h{level}>{html.escape(content)}</h{level}>")
        elif stripped.startswith("- "):
            flush_para()
            blocks.append(f"<ul><li>{html.escape(stripped[2:])}</li></ul>")
        else:
            para.append(stripped)
    flush_para()
    if code_lines:
        blocks.append(f"<pre><code>{html.escape(chr(10).join(code_lines))}</code></pre>")
    return "\n".join(blocks)


def wrap_html(title: str, body: str, *, summary: str = "", style_href: str = "../assets/page-style.css") -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index,follow">
  <title>{html.escape(title)}</title>
  <link rel="stylesheet" href="{html.escape(style_href)}">
</head>
<body>
  <div class="site-shell">
    <header class="site-header">
      <div class="crumb"><a href="../">Shared pages</a></div>
      <h1>{html.escape(title)}</h1>
      {f'<p class="summary">{html.escape(summary)}</p>' if summary else ''}
    </header>
    <main class="site-content">
{body}
    </main>
  </div>
</body>
</html>
"""


def looks_like_full_html(text: str) -> bool:
    prefix = text[:500].lower()
    return "<html" in prefix or "<!doctype html" in prefix


def title_from_name(path: Path) -> str:
    return path.stem.replace("-", " ").replace("_", " ").title()


def unique_name(filename: str, used: set[str]) -> str:
    """Return a filename unique within this publish operation."""
    candidate = filename
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    counter = 2
    while candidate in used:
        candidate = f"{stem}-{counter}{suffix}"
        counter += 1
    used.add(candidate)
    return candidate


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def commit_pages(slug: str, message: str, *, push: bool) -> None:
    subprocess.run(["git", "add", "pages"], cwd=ROOT, check=True)
    diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=ROOT)
    if diff.returncode == 0:
        print("No staged page changes to commit.")
    else:
        subprocess.run(["git", "commit", "-m", message], cwd=ROOT, check=True)
    if push:
        subprocess.run(["git", "push"], cwd=ROOT, check=True)


if __name__ == "__main__":
    raise SystemExit(main())
