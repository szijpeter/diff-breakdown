# Security policy

## Reporting a vulnerability

Use GitHub private vulnerability reporting for this repository. Do not open a public issue containing an exploit, credential, or private-repository data.

## Trust boundary

Diff Breakdown is a metadata-only Action intended for `pull_request_target`:

- it does not check out or execute pull-request code;
- it reads configuration from the exact base commit through the GitHub API;
- it treats paths, patches, branch names, and extracted declarations as untrusted display data;
- it only replaces a marker comment authored by `github-actions[bot]`;
- it needs only `contents: read` and `pull-requests: write`.

Do not add Gradle, Maven, SwiftPM, compiler, package-plugin, or repository-script execution to this privileged workflow. Such analysis belongs in a separate unprivileged `pull_request` workflow without secrets or a write-capable token.

## Release integrity

Consumers should pin the Action to a full commit SHA. Releases must rebuild `dist/` from source, run the complete test suite, and verify that the committed bundle matches the rebuild.
