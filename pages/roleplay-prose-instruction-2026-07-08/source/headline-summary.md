# Roleplay prose + instruction-following matrix — headline summary

**Date:** 2026-07-08  
**Harness:** GoblinBench `roleplay-prose` + `roleplay-instruction`  
**Candidate matrix:** same 15-model roleplay matrix used for heat-boundary run  
**Runs:** prose `run-20260707-211807-146e78c8` + `run-20260707-211808-c1866247`; instruction `run-20260707-222223-484bafea` + `run-20260707-214506-9c827b76`  
**Judge pass:** `den-router/grok`, roleplay prose rubric v1  
**Important caveat:** the judge is one model, the sample is small, and roleplay taste is subjective. Treat this as a map of tendencies, not a final model-war constitution.

## TL;DR

For **general prose quality**, the judged top tier was **DeepSeek Pro**, **GLM 5.2**, **DeepSeek Flash**, and **Grok**. DeepSeek Pro had the best aggregate rank across seven prose prompts; GLM 5.2 was often restrained and concrete; DeepSeek Flash had several scenario wins; Grok was excellent in multiple scenes but had one notable bad miss on an orbital prompt.

For **strict “do not write my character” instruction following**, the result was much sharper: **Grok was the only model the judge considered fully clean** on the reliquary probe. GLM 5.2 and Kimi-code were next, but still had slips. Most other models defaulted to second-person narration or wrote some version of Ari’s perceptions/actions.

So the practical read is:

- **Best overall prose:** `deepseek-pro`
- **Best prose restraint / quiet detail:** `glm-5.2`
- **Best instruction-following / no user control:** `grok`
- **Strong but uneven:** `deepseek-flash`, `grok`, `kimi`
- **Local models:** usable in places, but not competitive here on the no-user-control probe

## Prose-quality aggregate ranking

Average rank across seven SFW prose scenarios:

| overall | model / candidate | avg rank | avg score | quick read |
|---:|---|---:|---:|---|
| 1 | `deepseek-pro` | 3.14 | 8.07 | Best overall prose balance; multiple wins. |
| 2 | `glm-5.2` | 4.29 | 7.53 | Restrained, concrete, good at quiet scenes. |
| 3 | `deepseek-flash` | 4.43 | 7.54 | Several excellent scenes; one poor anti-slop result hurt aggregate. |
| 4 | `grok` | 4.86 | 7.34 | Strong voice/subtext, but one large miss. |
| 5 | `longcat-2.0` | 7.29 | 6.11 | Decent middle tier; sometimes too generic. |
| 6 | `kimi` | 8.14 | 6.10 | Can be strong, but inconsistent. |
| 7 | `Qwen3.6 uncensored aggressive` | 8.29 | 5.87 | Some useful scenes, but uneven. |
| 8 | `Qwen3.6-35B-A3B-GGUF` | 8.29 | 5.79 | Won one anti-slop scene, otherwise mixed. |
| 9 | `qwen-max` | 8.71 | 5.70 | Often serviceable but not standout. |
| 10 | `mimo-pro` | 8.86 | 5.80 | Mid/low; some softer prose strengths. |
| 11 | `Gemma-4-26B-A4B-it-GGUF` | 9.00 | 5.54 | Local and restrained, but less strong overall. |
| 12 | `qwenplus` | 9.71 | 5.23 | Uneven; one good orbital anti-slop result. |
| 13 | `Gemma4 uncensored balanced` | 11.29 | 4.74 | Did not shine on these SFW prose probes. |
| 14 | `stepfun` | 11.86 | 4.29 | A couple of decent moments, generally weak. |
| 15 | `kimi-code` | 11.86 | 4.24 | Good in one orbital scene, poor elsewhere. |

## Prose scenario winners

| scenario | winner | what it tested |
|---|---|---|
| Orbital maintenance v0 | `deepseek-flash` | first-person technical intimacy / subtext |
| Orbital maintenance v1 | `deepseek-pro` | anti-slop orbital variant |
| Rainy inn minimal | `glm-5.2` | default prose tendency with little steering |
| Rainy inn v0 | `deepseek-pro` | quiet third-person scene continuation |
| Rainy inn v1 | `Qwen3.6-35B-A3B-GGUF` | anti-cliche constrained prose |
| Train platform v0 | `deepseek-flash` | subtext / guarded conversation |
| Train platform v1 | `grok` | anti-slop train-platform variant |

## No-user-control instruction probe

This was the harshest and probably most practically useful result for roleplayers. The prompt explicitly said not to write Ari’s actions, dialogue, thoughts, feelings, reactions, decisions, body language, or internal state.

| rank | model / candidate | score | quick read |
|---:|---|---:|---|
| 1 | `grok` | 9.0 | Cleanest agency compliance; precise environment and NPC beats. |
| 2 | `glm-5.2` | 7.5 | Mostly compliant; good wire tracing and Maud voice; minor slips. |
| 3 | `kimi-code` | 6.5 | Strong NPC dialogue, but Cael addresses Ari directly. |
| 4 | `deepseek-flash` | 4.0 | Heavy second-person control. |
| 5 | `deepseek-pro` | 3.5 | Good prose model, but failed the strict agency contract here. |
| 6 | `kimi` | 3.0 | Slipped into controlling / directing the player character. |
| 7-15 | remaining models | 1.0-2.5 | Mostly significant user-control violations. |

## Takeaways for roleplayers

1. **Good prose and good instruction-following are not the same skill.** DeepSeek Pro won the prose aggregate but did poorly on strict no-user-control.
2. **Grok looks unusually good for players who hate being written for.** It won the dedicated no-user-control probe clearly.
3. **GLM 5.2 is a sleeper for quiet, restrained prose.** It ranked second overall in prose and second on no-user-control.
4. **Anti-slop prompting changes winners.** Qwen3.6 won one anti-cliche rainy inn variant despite being mid-pack overall.
5. **Local models were less competitive here than in the heat-boundary run.** They can be usable, but this matrix did not show them matching the best cloud models for prose/instruction balance.
6. **The no-user-control probe probably deserves more scenarios.** One reliquary scene was enough to expose widespread failure, but not enough to fully characterize every model’s agency discipline.

## Links in this report

- `prose judged report`: full side-by-side outputs and Grok judgements for all seven prose scenarios.
- `instruction judged report`: full side-by-side outputs and Grok judgement for the no-user-control reliquary scenario.
