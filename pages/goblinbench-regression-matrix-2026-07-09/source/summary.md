# GoblinBench requested regression matrix — 2026-07-09

Broad rerun requested for tool calling, deceptive/adversarial tool use, hallucination/groundedness, and codebase analysis after older pre-store results were not present in the canonical GoblinBench DB.

## Scope

Models, all through den-router (`http://127.0.0.1:18082/v1`):

`qwen-max`, `deepseek-flash`, `deepseek-pro`, `glm-5.2`, `longcat-2.0`, `grok-4.5`, `kimi-code`, `gpt-5.5-test-only`, `stepfun`, `mimo-pro`.

GoblinBench store run IDs:

| Category | Suites | Run IDs |
|---|---|---|
| Tool calling | `tool-call-behavior`, `mcp-tools` | `run-20260709-015748-7b0b3d07`, `run-20260709-020836-b5316037` |
| Deceptive/adversarial tool calling | `mcp-tools-hard`, `mcp-session`, `den-mcp-ambiguity`, `den-mcp-ambiguity-hinted` | `run-20260709-022522-2dc2d5b7`, `run-20260709-023650-bb33f5b7`, `run-20260709-024154-d40db14e`, `run-20260709-025630-57cbb6c6` |
| Hallucination/groundedness | `autonomy-calibration`, `evidence-grounding` | `run-20260709-030955-be55681c`, `run-20260709-031746-33fc603d` |
| Codebase analysis | Mode A `den-core-v1` fixture | `runs/requested-regression-matrix-20260709/codebase-analysis-den-core-v1/` |

Generated HTML grid reports are mobile-friendlier than the previous static report shell: they include a viewport tag and horizontal swipe affordance for wide tables.

## Store-backed aggregate pass rates

### By suite

| Suite | Cells | Passed | Pass rate |
|---|---:|---:|---:|
| `tool-call-behavior` | 40 | 37 | 92.5% |
| `mcp-tools` | 80 | 75 | 93.8% |
| `mcp-tools-hard` | 30 | 12 | 40.0% |
| `mcp-session` | 10 | 9 | 90.0% |
| `den-mcp-ambiguity` | 60 | 25 | 41.7% |
| `den-mcp-ambiguity-hinted` | 60 | 32 | 53.3% |
| `autonomy-calibration` | 30 | 10 | 33.3% |
| `evidence-grounding` | 30 | 30 | 100.0% |

### By model across all store-backed suites

| Model | Cells | Passed | Pass rate |
|---|---:|---:|---:|
| `glm-5.2` | 34 | 26 | 76.5% |
| `qwen-max` | 34 | 26 | 76.5% |
| `deepseek-pro` | 34 | 24 | 70.6% |
| `kimi-code` | 34 | 24 | 70.6% |
| `deepseek-flash` | 34 | 23 | 67.6% |
| `gpt-5.5-test-only` | 34 | 23 | 67.6% |
| `mimo-pro` | 34 | 22 | 64.7% |
| `longcat-2.0` | 34 | 21 | 61.8% |
| `stepfun` | 34 | 21 | 61.8% |
| `grok-4.5` | 34 | 20 | 58.8% |

### By model and category

| Model | Tool calling | Deceptive tool calling | Hallucination/grounding |
|---|---:|---:|---:|
| `qwen-max` | 12/12 (100%) | 9/16 (56%) | 5/6 (83%) |
| `glm-5.2` | 12/12 (100%) | 9/16 (56%) | 5/6 (83%) |
| `deepseek-flash` | 12/12 (100%) | 7/16 (44%) | 4/6 (67%) |
| `longcat-2.0` | 12/12 (100%) | 6/16 (38%) | 3/6 (50%) |
| `deepseek-pro` | 11/12 (92%) | 9/16 (56%) | 4/6 (67%) |
| `kimi-code` | 11/12 (92%) | 10/16 (63%) | 3/6 (50%) |
| `mimo-pro` | 11/12 (92%) | 5/16 (31%) | 6/6 (100%) |
| `stepfun` | 11/12 (92%) | 7/16 (44%) | 3/6 (50%) |
| `gpt-5.5-test-only` | 10/12 (83%) | 9/16 (56%) | 4/6 (67%) |
| `grok-4.5` | 10/12 (83%) | 7/16 (44%) | 3/6 (50%) |

## Codebase analysis Mode A — `den-core-v1`

Judge model: `deepseek-pro`. Gold ledger: 12 issues.

| Model | Recall | TP | FP | Bonus | Evidence | Duration |
|---|---:|---:|---:|---:|---:|---:|
| `deepseek-pro` | 83% | 10 | 0 | 5 | 94% | 159s |
| `kimi-code` | 83% | 10 | 1 | 11 | 85% | 214s |
| `mimo-pro` | 83% | 10 | 0 | 8 | 51% | 248s |
| `glm-5.2` | 75% | 9 | 0 | 6 | 66% | 160s |
| `deepseek-flash` | 67% | 8 | 1 | 6 | 100% | 74s |
| `longcat-2.0` | 67% | 8 | 0 | 6 | 52% | 310s |
| `qwen-max` | 58% | 7 | 0 | 6 | 98% | 198s |
| `gpt-5.5-test-only` | 33% | 4 | 0 | 5 | 66% | 153s |
| `grok-4.5` | 8% | 1 | 0 | 0 | 100% | 76s |

Notes:

- `stepfun` returned only a 187-character response and no parseable `findings.json`, so it is a harness/model-output failure for this Mode A codebase report rather than a judged model-quality score.
- The judge returned findings-only fallback parses for `gpt-5.5-test-only` and `mimo-pro`; their leaderboard values are computed from the per-finding judge records, but they do not have the richer qualitative `scoring.overall_assessment` prose.
- The highest codebase-analysis recall tier is a three-way tie by recall (`deepseek-pro`, `kimi-code`, `mimo-pro`), but `deepseek-pro` has much stronger evidence/severity calibration than `mimo-pro` and fewer false positives than `kimi-code`.

## Artifacts

- Tool calling grid: `tool-calling-grid.html`
- Deceptive tool-calling grid: `deceptive-tool-calling-grid.html`
- Hallucination/grounding grid: `hallucination-grounding-grid.html`
- Codebase analysis report: `codebase-analysis-den-core-v1/comparative-report.md`
- Run ID ledger: `run-ids.tsv`
- Full logs: `logs/*.log`
