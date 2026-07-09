# Codebase Analysis Benchmark — den-core-v1

*Generated: 2026-07-09T11:20:27.874439*
*Gold issues: 12*

| Model            | Recall   | TP   | FP   | Decoy hits   | Bonus   | Evidence   | Severity cal   | Duration   |
|------------------|----------|------|------|--------------|---------|------------|----------------|------------|
| qwen-max         | 58%    | 7   | 0   | 0          | 6       | 98%     | 60%      | 198s    |
| deepseek-flash   | 67%    | 8   | 1   | 0          | 6       | 100%     | 25%      | 74s     |
| deepseek-pro     | 83%    | 10  | 0   | 0          | 5       | 94%     | 65%      | 159s    |
| glm-5.2          | 75%    | 9   | 0   | 0          | 6       | 66%     | 27%      | 160s    |
| longcat-2.0      | 67%    | 8   | 0   | 0          | 6       | 52%     | 29%      | 310s    |
| grok-4.5         | 8%     | 1   | 0   | 0          | 0       | 100%     | 0%       | 76s     |
| kimi-code        | 83%    | 10  | 1   | 0          | 11      | 85%     | 40%      | 214s    |
| gpt-5.5-test-only | 33%    | 4   | 0   | 0          | 5       | 66%     | 11%      | 153s    |
| mimo-pro         | 83%    | 10  | 0   | 0          | 8       | 51%     | 6%       | 248s    |
## Issue Coverage Matrix

| Gold Issue | Severity | qwen-max | deepseek-flash | deepseek-pro | glm-5.2 | longcat-2.0 | grok-4.5 | kimi-code | gpt-5.5-test-only | mimo-pro |
|---|---|---|---|---|---|---|---|---|---|---|

| **contract-paging-mismatch** | high | · | · | · | · | · | · | · | · | ✓ |
| **worker-release-before-completion** | high | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| **stale-review-verdict** | medium | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | ✓ |
| **hardcoded-lan-ip** | medium | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | ✓ |
| **exception-in-background-loop** | critical | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ |
| **core-mcp-boundary-leak** | medium | · | · | ✓ | · | · | · | · | · | · |
| **health-check-ignores-db** | medium | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | ✓ |
| **tool-schema-description-mismatch** | medium | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · | ✓ |
| **singleton-cache-no-lock** | low | · | ~ | · | ✓ | · | · | ✓ | · | ✓ |
| **documentation-contradiction** | low | · | ✓ | ✓ | · | · | · | ✓ | ✓ | ✓ |
| **missing-404-test** | low | ✓ | · | ✓ | ✓ | ✓ | · | ✓ | ✓ | ✓ |
| **assignment-release-null-state** | medium | · | · | ✓ | ✓ | ✓ | · | ✓ | · | · |

## Qualitative Assessment

### qwen-max

**Overall:** Thorough analysis with strong evidence; correctly identified the critical background-loop failure and the premature worker release. Overrated severity of a few medium issues, and missed several gold-level problems (pagination mismatch, MCP boundary leak, documentation contradiction, assignment release idempotency). No false positives or decoy hits, and found six genuine bonus issues.

**Best finding:** Background Dispatch Loop Dies Silently on Transient Exceptions
> The RunBackgroundLoopAsync method lacks a top-level try/catch block inside the while loop. If DequeueBatchAsync throws an exception (e.g., SQLite 'database is locked'), the exception propagates out of the Task.Run delegate. The background task terminates silently, and the dispatch queue stops processing permanently.
> *Precisely identifies a critical operational fragility, connects it to the fire-and-forget pattern, and explains the concrete impact of a silent stoppage.*

**Key miss:** contract-paging-mismatch
> The candidate did not detect the mixed offset/cursor pagination: MessageRoutes returns a nextCursor that no consumer reads, while TaskRepository uses offset-based paging. This breaks pagination for message listings, a high-severity API contract violation.

### deepseek-flash

**Overall:** Candidate demonstrated strong understanding of correctness and operational concerns, successfully identifying 8 of 12 gold issues. Several high-severity items were missed (paging mismatch, boundary leak, missing 404 test, idempotent release). One false positive on authentication, but no decoy hits. Six bonus findings add value. Evidence quality is consistently high.

**Best finding:** Worker release order violates atomicity
> // STEP 1: Release the assignment — makes the pool member available ... await WriteCompletionPacketAsync(assignmentId); // This happens AFTER the release
> *Clearly pinpoints the ordering defect with a direct code quote, explains the race window and potential for duplicate work, and proposes a concrete fix (write first, then release, ideally in a transaction).*

**Key miss:** contract-paging-mismatch
> The gold high-severity issue about cursor/offset pagination mix-up in MessageRoutes was not detected. This can cause clients to misinterpret pagination and miss or duplicate items, a significant API contract violation.

### deepseek-pro

**Overall:** The candidate demonstrates strong analysis, capturing 10 of 12 gold issues with high‑quality evidence. The two misses (pagination mismatch and cache race condition) are significant gaps. The additional five bonus findings are genuine and add value, with no false positives or decoy hits. Evidence is mostly direct code quotes, and severity calibration shows a slight tendency to overrate (especially missing‑404 and documentation issues) while underrating a few. Overall a thorough and accurate review.

**Best finding:** Dispatch background loop crashes silently on outer exception
> return Task.Run(async () => { while (!token.IsCancellationRequested) { var batch = await DequeueBatchAsync(10); ... } }, token);
> *This excerpt pinpoints the exact code location and clearly explains how an unhandled exception kills the dispatch loop permanently. The diagnosis is precise and the impact description (green health check masking failure) shows systemic understanding.*

**Key miss:** contract-paging-mismatch
> The candidate did not identify the mixed cursor/offset pagination in MessageRoutes and the unused nextCursor. This is a high‑severity API design flaw that leads to broken client pagination and potential data inconsistencies.

### glm-5.2

### longcat-2.0

### grok-4.5

**Overall:** The candidate accurately pinpointed one high-severity ordering defect with strong evidence and a credible fix. However, it submitted only a single finding, missing 11 other gold issues including critical and medium severity items. The severity was overrated (critical vs. high). No false positives or decoy hits.

**Best finding:** Worker released to pool before completion is durable
> Release frees capacity and marks the assignment completed before the completion packet is written. ReleaseAssignmentAsync ignores prior state and never checks ReleaseNonce, so concurrent release/reassign can interleave.
> *Clearly articulates the root cause and concurrency risks, linking the ordering bug to the practical impact of duplicate work and corrupted state.*

**Key miss:** exception-in-background-loop
> Critical issue: DispatchRepository.RunBackgroundLoopAsync uses a fire-and-forget Task.Run loop with no per-iteration exception handling, risking silent termination of the background dispatcher. Not mentioned by the candidate.

### kimi-code

**Overall:** The candidate uncovered the majority of gold issues with strong evidence. A few gold items (core layer leak, cursor consumer mismatch) were missed. The model slightly overrated severity on several medium/low issues. It also surfaced 11 genuine problems not in the gold ledger, showing thoroughness. One false positive flagged a documented 'not yet implemented' auth gap.

**Best finding:** Dispatch background loop is fire-and-forget and crashes silently
> RunBackgroundLoopAsync is invoked without awaiting or registering with IHostedService, and the per-iteration DequeueBatchAsync call is not wrapped in try/catch. A failure in polling aborts the entire loop silently.
> *This excerpt precisely links the fire-and-forget pattern to the silent crash risk, demonstrates clear root-cause analysis, and proposes an actionable architectural fix.*

**Key miss:** core-mcp-boundary-leak
> The core domain model ProjectTask contains an MCP-specific field `McpToolProfile`, violating layering. The candidate did not flag this, missing an important maintenance and architectural concern.

### gpt-5.5-test-only

### mimo-pro


---

## Role Routing Recommendation

- **Planner/Architect:** deepseek-pro (highest recall + evidence quality)
- **Reviewer:** deepseek-pro (good recall + bonus/real-finding awareness)
- **Operator:** kimi-code (fewer false positives, tradeoff awareness)
- **Cheap triage:** kimi-code (best value for cost)

---
*Report generated by codebase-analysis-runner.py*