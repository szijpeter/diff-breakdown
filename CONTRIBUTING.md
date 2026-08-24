# Contributing

Thanks for helping make pull-request review context clearer with Diff Breakdown.

Before opening a pull request:

1. Keep classification deterministic and retain provenance for inferred facts.
2. Account for every changed file exactly once.
3. Treat all PR-controlled values as untrusted display data.
4. Add focused tests for new layouts, comment views, and escaping boundaries.
5. Run `npm run check`.

New language support should begin as a path/layout preset. Build- or compiler-backed analysis must remain optional and outside the privileged metadata workflow.
