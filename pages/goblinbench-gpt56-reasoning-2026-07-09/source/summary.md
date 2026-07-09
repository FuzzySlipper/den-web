# GoblinBench GPT-5.6 reasoning-effort matrix — 2026-07-09

New-model extension of the July 09 general complex agentic-fitness matrix. This run tests the three GPT-5.6 variants at `reasoning_effort=medium` and `reasoning_effort=high`, then generates combined old+new report grids.

Public-reader headline: **medium/high reasoning did not lift the GPT-5.6 family above the earlier best models on the store-backed agentic suites.** The best GPT-5.6 rows tie the old `gpt-5.5-test-only` store-backed score, but still trail `glm-5.2`, `qwen-max`, `deepseek-pro`, and `kimi-code`. Codebase analysis showed a more dramatic effort swing, but mostly in the wrong direction: several high-effort rows collapsed to 0% recall.

## Run IDs

| suite | run id |
|---|---|
| tool-call-behavior | `run-20260709-155659-8524c128` |
| mcp-tools | `run-20260709-155911-ff552350` |
| mcp-tools-hard | `run-20260709-160206-a711d202` |
| mcp-session | `run-20260709-160412-d443ac3c` |
| den-mcp-ambiguity | `run-20260709-160507-2e93e598` |
| den-mcp-ambiguity-hinted | `run-20260709-160943-d5f78f82` |
| autonomy-calibration | `run-20260709-161246-2b3885ab` |
| evidence-grounding | `run-20260709-161348-30b7f62e` |
| codebase-analysis Mode A | `runs/requested-regression-matrix-20260709-gpt56-reasoning/codebase-analysis-den-core-v1` |

## Store-backed aggregate — new GPT-5.6 rows only

| Model variant | Cells | Passed | Pass rate | Avg sec/cell |
|---|---:|---:|---:|---:|
| `gpt-5.6-luna-test-only` medium | 34 | 23 | 67.6% | 4.7 |
| `gpt-5.6-terra-test-only` medium | 34 | 23 | 67.6% | 3.9 |
| `gpt-5.6-terra-test-only` high | 34 | 23 | 67.6% | 4.8 |
| `gpt-5.6-luna-test-only` high | 34 | 22 | 64.7% | 5.2 |
| `gpt-5.6-sol-test-only` high | 34 | 21 | 61.8% | 6.6 |
| `gpt-5.6-sol-test-only` medium | 34 | 20 | 58.8% | 6.2 |

Effort aggregate over all new store-backed cells:

| Effort | Cells | Passed | Pass rate | Avg sec/cell |
|---|---:|---:|---:|---:|
| medium | 102 | 66 | 64.7% | 4.9 |
| high | 102 | 66 | 64.7% | 5.6 |

So for the store-backed tool/deceptive/grounding suites, **high effort did not improve aggregate pass rate** and was slightly slower.

## Store-backed aggregate — old + new leaderboard

| Model / variant | Cells | Passed | Pass rate | Avg sec/cell |
|---|---:|---:|---:|---:|
| `glm-5.2` | 34 | 26 | 76.5% | 12.2 |
| `qwen-max` | 34 | 26 | 76.5% | 17.3 |
| `deepseek-pro` | 34 | 24 | 70.6% | 14.5 |
| `kimi-code` | 34 | 24 | 70.6% | 19.1 |
| `deepseek-flash` | 34 | 23 | 67.6% | 7.6 |
| `gpt-5.5-test-only` | 34 | 23 | 67.6% | 7.2 |
| `gpt-5.6-luna-test-only` medium | 34 | 23 | 67.6% | 4.7 |
| `gpt-5.6-terra-test-only` medium | 34 | 23 | 67.6% | 3.9 |
| `gpt-5.6-terra-test-only` high | 34 | 23 | 67.6% | 4.8 |
| `gpt-5.6-luna-test-only` high | 34 | 22 | 64.7% | 5.2 |
| `mimo-pro` | 34 | 22 | 64.7% | 11.0 |
| `gpt-5.6-sol-test-only` high | 34 | 21 | 61.8% | 6.6 |
| `longcat-2.0` | 34 | 21 | 61.8% | 15.0 |
| `stepfun` | 34 | 21 | 61.8% | 37.4 |
| `gpt-5.6-sol-test-only` medium | 34 | 20 | 58.8% | 6.2 |
| `grok-4.5` | 34 | 20 | 58.8% | 13.0 |

## Category breakdown — new GPT-5.6 rows

| Model variant | Tool calling | Deceptive/adversarial | Hallucination/grounding |
|---|---:|---:|---:|
| `gpt-5.6-terra` medium | 10/12 | 8/16 | 5/6 |
| `gpt-5.6-terra` high | 10/12 | 8/16 | 5/6 |
| `gpt-5.6-luna` medium | 9/12 | 9/16 | 5/6 |
| `gpt-5.6-luna` high | 9/12 | 9/16 | 4/6 |
| `gpt-5.6-sol` medium | 8/12 | 8/16 | 4/6 |
| `gpt-5.6-sol` high | 10/12 | 7/16 | 4/6 |

Interpretation:

- Terra is the most balanced GPT-5.6 row in this matrix.
- Luna is slightly better on deceptive/adversarial tool-use but loses one grounding cell at high effort.
- Sol high improves basic tool-calling vs Sol medium, but loses one deceptive/adversarial cell.
- None of the GPT-5.6 rows break the current top store-backed band (`glm-5.2` / `qwen-max`).

## Codebase analysis Mode A — old + new

Judge: `deepseek-pro`. The GPT-5.6 codebase judge passes used findings-only extraction, so qualitative prose fields are sparse; recall/coverage are still derived from per-finding judge matches.

| Model / variant | Recall | TP | FP | Bonus | Evidence | Duration |
|---|---:|---:|---:|---:|---:|---:|
| `deepseek-pro` | 83% | 10 | 0 | 5 | 94% | 159s |
| `kimi-code` | 83% | 10 | 1 | 11 | 85% | 214s |
| `mimo-pro` | 83% | 10 | 0 | 8 | 51% | 248s |
| `glm-5.2` | 75% | 9 | 0 | 6 | 66% | 160s |
| `deepseek-flash` | 67% | 8 | 1 | 6 | 100% | 74s |
| `longcat-2.0` | 67% | 8 | 0 | 6 | 52% | 310s |
| `gpt-5.6-terra` medium | 67% | 8 | 1 | 7 | 64% | 66s |
| `gpt-5.6-sol` medium | 67% | 8 | 0 | 14 | 65% | 154s |
| `qwen-max` | 58% | 7 | 0 | 6 | 98% | 198s |
| `gpt-5.5-test-only` | 33% | 4 | 0 | 5 | 66% | 153s |
| `gpt-5.6-luna` high | 25% | 3 | 0 | 8 | 63% | 90s |
| `grok-4.5` | 8% | 1 | 0 | 0 | 100% | 76s |
| `gpt-5.6-terra` high | 0% | 0 | 0 | 1 | 66% | 91s |
| `gpt-5.6-luna` medium | 0% | 0 | 1 | 0 | 33% | 56s |
| `gpt-5.6-sol` high | 0% | 0 | 0 | 5 | 66% | 221s |

This is the most interesting result: **medium reasoning is clearly better than high for Terra and Sol on this codebase-analysis fixture.** High effort appears to wander into bonus/non-gold findings or otherwise misses the planted ledger issues.

## Artifacts

- Combined tool-calling grid: `tool-calling-combined-grid.html`
- Combined deceptive/adversarial grid: `deceptive-tool-calling-combined-grid.html`
- Combined hallucination/grounding grid: `hallucination-grounding-combined-grid.html`
- GPT-5.6 codebase report: `codebase-analysis-den-core-v1/comparative-report.md`
- Old+new codebase report: `codebase-analysis-combined-report.md`
- Run ledger: `run-ids.tsv`

## Bottom line

This does **not** support “just crank reasoning high” for these agentic evaluations. Medium/high tied on aggregate store-backed pass rate, and high was meaningfully worse in codebase-analysis for two of the three GPT-5.6 variants.

Best GPT-5.6 setting from this run:

- Store-backed agentic suites: `terra` medium/high or `luna` medium are tied-ish.
- Codebase analysis: `terra` medium and `sol` medium are the only competitive GPT-5.6 rows.
- Overall practical pick: **`gpt-5.6-terra-test-only` at medium** — tied top GPT-5.6 store-backed score, fastest among the 23/34 rows, and solid 67% codebase recall.
