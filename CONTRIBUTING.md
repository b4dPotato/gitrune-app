# Contributing to Gitrune

Thank you for helping improve Gitrune. The project is an early Windows-first desktop Git client, so correctness and data safety take priority over feature breadth.

## Before opening work

- Search existing issues and the [required-work backlog](docs/REQUIRED_WORK.md).
- For a substantial feature or behavior change, open an issue describing the use case and safety implications before investing in an implementation.
- Keep GitHub/provider features out of the local Git core. Gitrune must remain usable without a hosted backend or product account.
- Never include credentials, private keys, repository contents, or real operation logs in fixtures or screenshots.

## Development setup

Requirements are listed in the [README](README.md). The pinned Node and Rust versions are in `.nvmrc` and `rust-toolchain.toml`.

```powershell
npm ci
npm run tauri dev
```

Browser mode cannot execute Git. Use `VITE_DEMO_MODE=true` only for explicit UI preview work.

## Source rules

- Follow [the refactoring guide](docs/REFACTORING_GUIDE.md) and keep views as composition roots.
- Put capability-specific UI and behavior in `src/features/<capability>/`.
- Keep the IPC surface typed and capability-specific. Do not add a generic shell or unrestricted Git endpoint.
- Pass Git arguments as arrays and place user-supplied paths after `--`.
- Reuse shared action buttons, forms, confirmations, and operation handling.
- Add semantic i18n keys for user-facing copy and preserve English as the fallback.
- Add a regression test for every corrected Git edge case.

## Verification

Run before submitting:

```powershell
npm run verify
```

For desktop behavior, also follow the relevant part of [the Windows smoke-test checklist](docs/WINDOWS_SMOKE_TEST.md). Tests must use disposable repositories and local bare remotes; they must not rely on a network account.

## Commits and pull requests

- Prefer focused commits using a conventional prefix such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, or `chore:`.
- Explain user-visible behavior, safety tradeoffs, and test evidence in the pull request.
- Update `CHANGELOG.md` for user-visible changes.
- Do not commit generated build directories, local databases, credentials, or release artifacts.

Unless explicitly marked otherwise, contributions intentionally submitted to the project are licensed under Apache-2.0 as described in section 5 of the license. No separate contributor license agreement is required.
