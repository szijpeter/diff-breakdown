# Diff Breakdown

Diff Breakdown is a GitHub Action that explains what changed in a pull request. It posts one sticky comment covering production code, tests, modules, platforms, API baselines, and configured dependency reach.

It works without a checkout or build execution. Kotlin, Java, and Swift layouts receive first-class classification; other repositories get useful generic source, test, docs, sample, tooling, and dependency categories.

## Add it to a repository

Create `.github/workflows/diff-breakdown.yml`:

```yaml
name: Diff Breakdown

on:
  pull_request_target:
    types: [opened, synchronize, reopened, ready_for_review]

permissions:
  contents: read
  pull-requests: write

jobs:
  breakdown:
    runs-on: ubuntu-latest
    steps:
      - uses: szijpeter/diff-breakdown@v0.1.0
        with:
          token: ${{ github.token }}
```

No checkout is needed. For the strongest supply-chain guarantee, replace the version tag with the full commit SHA from the release.

## What reviewers see

The comment keeps the high-signal overview open and the supporting views collapsible:

- 📊 exact category totals and a Mermaid composition chart;
- module-by-change-kind intensity matrix;
- Kotlin Multiplatform, JVM, Android, Apple, Web, Native, and Swift distribution;
- added, modified, removed, renamed, and copied file counts;
- textual `.api` and `.klib.api` declaration changes when GitHub supplies patches;
- direct and transitive dependents from an optional configured graph;
- explicit warnings for incomplete GitHub metadata or unclassified source files.

Change volume is review context, not a risk, quality, or test-coverage score.

## Configuration

Zero configuration auto-detects relevant layouts. For a monorepo, add `.github/diff-breakdown.yml` on the base branch:

```yaml
$schema: https://raw.githubusercontent.com/szijpeter/diff-breakdown/main/diff-breakdown.schema.json
version: 1
title: Mobile change map
presets: [kotlin-gradle, java-gradle, swift-package]

modules:
  roots:
    - "core/*"
    - "client/*"
    - pattern: "ios/features/*"
      name: "apple-$1"

categories:
  - id: contracts
    label: Cross-language contracts
    icon: "🔗"
    priority: 100
    include: ["contracts/**", "**/interop/**"]

platforms:
  - id: swift-bridge
    label: Swift bridge
    include: ["ios/**/Sources/**/*.swift"]

dependencyGraph:
  edges:
    - { from: "client/mobile", to: "core/model" }
    - { from: "ios/passkeys", to: "core/model" }

views: [composition, status, modules, platforms, api, dependencies]
```

An edge `{ from: app, to: core }` means `app` depends on `core`. The schema rejects unknown keys, unsafe markers, and malformed selectors.

The Action always loads configuration from the pull request's base commit. A fork pull request cannot change the privileged workflow's behavior.

## Inputs and outputs

| Input | Default | Purpose |
|---|---|---|
| `token` | required | Reads PR metadata and maintains the comment |
| `pr-number` | event PR | Supports manual or composed workflows |
| `config-path` | `.github/diff-breakdown.yml` | Trusted YAML or JSON configuration |
| `comment` | `true` | Creates or updates the sticky comment |
| `summary` | `true` | Writes the same breakdown to the job summary |

Outputs are `total-files`, `total-churn`, and `warning-count`.

## Security and limits

The Action never checks out or executes pull-request code. It treats paths, patches, branch names, and extracted declarations as untrusted display data. See [SECURITY.md](SECURITY.md) for the full trust boundary.

GitHub's pull-request files API returns at most 3,000 files. Larger pull requests are clearly marked incomplete. Patch text can also be absent for binary or very large files; declaration details are then marked partial while file-level totals remain available.

## Development

```bash
npm ci
npm run check
```

The committed Node 24 bundle is rebuilt by the check and verified in CI. Real pull-request replay evidence is recorded in [docs/validation.md](docs/validation.md).

Apache-2.0 licensed.
