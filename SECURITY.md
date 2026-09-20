# Security policy

## Supported versions

Gitrune is currently an unsigned `0.1.x` alpha. Security fixes are applied to the latest commit on `main`; older builds are not supported.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability.

Use GitHub's private vulnerability reporting for this repository:

`https://github.com/b4dPotato/gitrune-app/security/advisories/new`

Include the affected version or commit, operating system, reproduction steps, impact, and any suggested mitigation. Remove tokens, credentials, private keys, repository contents, and personal information from the report.

The maintainers will acknowledge a complete report when available, validate it, coordinate a fix, and publish an advisory when disclosure is appropriate. No guaranteed response time or bug bounty is offered while the project is maintained on a best-effort basis.

## Security boundary

Gitrune executes the system Git binary and relies on the user's credential helpers, SSH configuration, and agent. It does not store passwords, tokens, or private keys. See [the local-first architecture](docs/LOCAL_FIRST_ARCHITECTURE.md) for the trust model.
