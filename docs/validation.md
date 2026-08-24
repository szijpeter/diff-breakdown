# Validation evidence

The 0.1 classifier was replayed against four structurally different pull requests from the repository that inspired Diff Breakdown. GitHub's pull-request totals were passed back into the analyzer as invariants; any file, addition, or deletion mismatch would fail the replay.

| Pull request | Shape | GitHub totals | Breakdown totals | Warnings |
|---|---|---:|---:|---:|
| [#252](https://github.com/szijpeter/webauthn-kotlin-multiplatform/pull/252) | Large Kotlin/Swift refactor | 104 files, +1,227/-2,307 | 104 files, +1,227/-2,307 | 0 |
| [#253](https://github.com/szijpeter/webauthn-kotlin-multiplatform/pull/253) | Feature change | 35 files, +784/-82 | 35 files, +784/-82 | 0 |
| [#256](https://github.com/szijpeter/webauthn-kotlin-multiplatform/pull/256) | Samples, tests, and API baselines | 85 files, +1,646/-2,851 | 85 files, +1,646/-2,851 | 0 |
| [#262](https://github.com/szijpeter/webauthn-kotlin-multiplatform/pull/262) | Documentation-heavy publication | 68 files, +4,276/-78 | 68 files, +4,276/-78 | 0 |

This replay was performed through the GitHub API on 2026-08-24 with the WebAuthn repository's trusted configuration. It validates accounting and classification against real metadata; it does not substitute for the committed unit, integration, escaping, and bundle-runtime tests.
