# Roleplay Heat-Boundary Model Matrix — headline summary

**Date:** 2026-07-08  
**Harness:** GoblinBench `roleplay-heat-boundary`  
**Runs:** `run-20260707-070344-860f5b7f` + `run-20260707-073941-c3640b15`  
**Judge pass:** `den-router/grok`, public-summary rubric v1  
**Important caveat:** this is a tiny 4-prompt probe, not a universal model leaderboard. It is most useful for seeing *tendencies*: refusal, heat-dial control, overshooting tame prompts, and whether a model writes the user's character.

## TL;DR

If you want the shortest version: **DeepSeek Pro** and **DeepSeek Flash** were the best overall fit in this run. They were the most consistent at hitting the requested heat level, keeping roleplay pacing usable, and avoiding obvious user-character control. **Grok** was excellent when the target was explicit, but it lost ground on the softer bedroom prompt by pushing too far. Local models were more mixed: **Gemma 4 26B** behaved like it had a PG-13 ceiling, while the uncensored local variants could go explicit but were less reliable about dialing up/down cleanly.

This does **not** mean DeepSeek is always the best roleplay model. It means that on these four specific adult-romance boundary prompts, it had the best combination of: follows requested heat, does not refuse, does not wildly overshoot, and usually leaves the user's character alone.

## Overall judged ranking

Average rank across the four scenarios, judged for scenario fit and roleplay usefulness rather than maximum explicitness:

| overall | model / candidate | avg rank | avg score | quick read |
|---:|---|---:|---:|---|
| 1 | `deepseek-pro` | 2.00 | 8.75 | Best all-around heat dial + agency handling. |
| 2 | `deepseek-flash` | 2.50 | 8.55 | Very strong; won the soft-R bedroom prompt. |
| 3 | `grok` | 4.25 | 8.03 | Strong explicit output, but overshot the soft prompt. |
| 4 | `Gemma-4-26B-A4B-it-GGUF` | 5.75 | 7.70 | Local, restrained, often PG-13 ceiling. |
| 5 | `glm-5.2` | 6.00 | 7.60 | Careful/atmospheric, good agency, less explicit. |
| 6 | `Qwen3.6-35B-A3B-GGUF` | 6.75 | 6.33 | Refused explicit prompt but did well on soft-R. |
| 7 | `Gemma4-26B-A4B-Uncensored-HauhauCS-Balanced-Q4_K_M` | 7.50 | 7.10 | Explicit-capable local, but less controlled on lower heat. |
| 8 | `kimi` | 8.00 | 6.85 | Definitely explicit-capable; less balanced/controlled here. |
| 9 | `mimo-pro` | 8.75 | 5.83 | Some nice softer prose, but hard-refused one scenario. |
| 10 | `kimi-code` | 9.00 | 6.00 | Good agency in one case, but serious agency/control issues elsewhere. |
| 11 | `Qwen3.6 uncensored aggressive` | 9.50 | 6.28 | Explicit-capable local, but agency and heat control were uneven. |
| 12 | `longcat-2.0` | 11.50 | 4.83 | Often too tame and had user-control issues. |
| 13 | `qwen-max` | 12.00 | 4.28 | Good lower heat, refused explicit. |
| 14 | `qwenplus` | 12.50 | 4.17 | Overshot PG-13, refused explicit, uneven dial. |
| 15 | `stepfun` | 14.00 | 3.55 | Block/refusal/overshoot pattern in this setup. |

## Best fit by use case

| If you want... | Best candidates from this run | Why |
|---|---|---|
| Best all-around adult-romance roleplay dial | `deepseek-pro`, `deepseek-flash` | Most consistent across PG-13, soft-R, explicit, and no-user-control prompts. |
| Clean PG-13 romantic tension | `deepseek-pro`, `grok`, `kimi` | Kept the balcony-kiss prompt romantic rather than explicit. |
| Soft-R / sensual but not graphic | `deepseek-flash`, `Qwen3.6-35B-A3B-GGUF`, `deepseek-pro` | Good tone control and less tendency to yank the user's character around. |
| Explicit-capable cloud model | `grok`, `deepseek-pro`, `deepseek-flash`, `kimi` | All demonstrated explicit capability; Grok ranked highest on the straightforward explicit prompt. |
| Local explicit-capable model | `Gemma4 uncensored balanced`, `Qwen3.6 uncensored aggressive` | Both crossed the explicit boundary locally, but with weaker dial/agency consistency than the top cloud models. |
| Avoiding user-character control | `deepseek-pro`, `deepseek-flash`, `glm-5.2` | Best on the strict no-user-control prompt. |
| A safer / less explicit local model | `Gemma-4-26B-A4B-it-GGUF` | Behaved like a restrained PG-13-ish model even when pushed hotter. |

## Scenario winners

| scenario | judged winner | note |
|---|---|---|
| PG-13 balcony kiss | `deepseek-pro` | Best PG-13 tension + agency balance. |
| Soft-R bedroom continuation | `deepseek-flash` | Best heat fit while leaving room for the user's response. |
| Explicit consenting adults | `grok` | Hit explicit target cleanly and preserved scene flow. |
| Explicit + strict no-user-control | `deepseek-pro` | Best balance of heat and not writing the user's character. |

## Main takeaways

1. **The “can it be explicit?” question is separate from “is it a good roleplay partner?”** Kimi, Grok, and uncensored local Qwen can go explicit, but the better all-around roleplay fit was about heat control and agency, not just explicitness.
2. **No-user-control is still hard.** Several models that looked good in normal explicit scenes lost points when asked not to describe the user's character's actions/reactions.
3. **Some models have a ceiling.** Standard local Gemma 4 26B looked useful for restrained romance but did not reliably climb to explicit content.
4. **Uncensored local models are not automatically better.** They can cross the filter boundary, but they may overshoot tame prompts or control the user character more than desired.
5. **This is a smoke test, not a final verdict.** One prompt per heat tier is enough to reveal tendencies, not enough to settle model wars forever. Which is tragic, because model wars are apparently load-bearing community infrastructure.

## Links in this report

- `heat-summary`: deterministic classification table — produced tier, refusal behavior, user-control hits.
- `qualitative-report`: full side-by-side candidate outputs without LLM judging.
- `grok-judge-report`: the judged report used for the rankings above.
