# Gitrune

[![CI](https://github.com/b4dPotato/gitrune-app/actions/workflows/ci.yml/badge.svg)](https://github.com/b4dPotato/gitrune-app/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

> **Alpha:** Gitrune is Windows-first, unsigned, and not yet release-certified. Back up important repositories and review the [known release work](docs/REQUIRED_WORK.md) before relying on it for critical workflows.

Gitrune is a Windows-first, local desktop Git client built with Tauri 2, React, TypeScript, Rust, and the system Git executable. It combines a visual commit graph with the daily repository operations expected from desktop clients, without a hosted backend, product account, or paid feature gate.

Repository contents remain on disk. The app stores only local preferences, registered repository paths, operation history, and recovery metadata in SQLite. Authentication continues to use the user's existing Git credential helpers, SSH configuration, and agent; the app stores no credentials.

## Implemented local workflow

- Open, initialize, and clone repositories; automatic filesystem refresh.
- Stage or unstage files, hunks, and selected lines, including mixed index/worktree states.
- Recoverable discard for tracked and untracked files with restoration from Operation Log.
- Commit, amend, optional Git signing, commit templates, initial-commit-safe undo, and optional push-after-commit.
- Typed remote management, default remote selection, fetch one/all, branch publication, and upstream management.
- Incoming/outgoing commit lists; explicit pull-with-merge and pull-with-rebase; guarded force-with-lease.
- Local and remote branches, stashes (inspect/apply/pop/drop/branch), and lightweight or annotated tags.
- Real worktree state and safe removal; merge/rebase/cherry-pick/revert conflict resolution and validated continue/abort.
- Graph 2.0: backend cursor pages, virtualized rows, filters, comparisons, file history, blame, line history, and safe commit context actions.
- Structured redacted errors, per-repository mutation serialization, durable operation records, streamed network progress, and cancellation.
- Versioned SQLite migrations and persisted theme, UI zoom, resizable layouts, diff, editor, and terminal preferences.
- Dark/light plus Dracula, Nord, Solarized, and locally editable custom themes.
- Runtime-switchable English, Polish, and Ukrainian localization with a persisted local language preference; English is the complete fallback while specialist workflow copy is migrated.
- Local Git identity profiles that apply author, email, signing defaults, and optional SSH Host alias metadata as repository-local configuration. Credentials and private keys remain outside the app.

GitHub accounts, pull requests, notifications, named workspaces, editable three-way merging, code signing, and automatic updates are intentionally deferred. Provider preview screens are hidden in normal desktop navigation.

See [the compatibility matrix](docs/COMPATIBILITY.md) for supported boundaries, [the local-first architecture](docs/LOCAL_FIRST_ARCHITECTURE.md) for the trust boundary, [the refactoring guide](docs/REFACTORING_GUIDE.md) for source rules, [the internationalization guide](docs/I18N.md) for locale conventions, and [the required-work backlog](docs/REQUIRED_WORK.md) for the release-critical work that remains.

## Branding

The [brand kit](docs/branding/kit/README.md) includes SVG logos, light/dark wordmarks, Windows/macOS/Linux application icons, website favicons, and social images. See the [preview](docs/branding/kit/preview.png) or download the [Gitrune brand kit ZIP](docs/branding/gitrune-brand-kit.zip). Tauri uses the generated icons in `src-tauri/icons/brand-v1/`; the original icons are preserved. The isolated exporter and validation scripts are in `tools/branding/`.

Gitrune retains the internal bundle identifier `dev.eduard.gitapp` and database filename `gitapp.sqlite` for compatibility with existing local data. These are persistence identifiers, not the product name. The package and executable are named `gitrune`.

## Requirements

- Windows 10/11 with WebView2
- Git 2.31 or newer on `PATH`
- Node.js and npm
- Rust toolchain
- Visual Studio Build Tools with **Desktop development with C++** and a Windows SDK

## Run

```powershell
npm install
npm run tauri dev
```

A plain browser cannot execute Git. It shows a desktop-runtime explanation unless demo mode is explicitly enabled:

```powershell
$env:VITE_DEMO_MODE="true"
npm run dev
```

## Verify and package

```powershell
npm run verify
npm run package:windows
```

`npm run verify` runs the dependency audit, Prettier check, Vitest, TypeScript/Vite production compilation, Rust formatting, strict Clippy, and Rust tests. Rust fixtures create disposable repositories and local bare remotes; they do not need internet access. `npm run package:windows` additionally creates NSIS/MSI installers, `artifacts/Gitrune-<version>-windows-x64-portable.zip`, and its SHA-256 checksum.

Before treating a package as a release candidate, complete the [Windows desktop smoke test](docs/WINDOWS_SMOKE_TEST.md).

## Contributing and support

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before proposing or implementing changes.
- Use [GitHub Issues](https://github.com/b4dPotato/gitrune-app/issues) for sanitized bug reports and focused feature proposals.
- Read [SUPPORT.md](SUPPORT.md) for support boundaries and [SECURITY.md](SECURITY.md) for private vulnerability reporting.
- Accessibility targets and known certification gaps are documented in [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md).
- Local data, backup, recovery, reset, and uninstall behavior are documented in [docs/PRIVACY_AND_DATA.md](docs/PRIVACY_AND_DATA.md).
- Release rules are documented in [docs/RELEASING.md](docs/RELEASING.md).

## License

Gitrune source code, documentation, and original project assets are licensed under [Apache-2.0](LICENSE). Third-party material retains its own license; see [NOTICE](NOTICE), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and [LICENSES](LICENSES/README.md). Apache-2.0 does not grant trademark rights; see [the branding and trademark policy](docs/BRANDING_AND_TRADEMARKS.md).

## Source layout

```text
src/
  components/   reusable desktop shell, layout, forms, confirmations, UI primitives
  features/     capability-focused components (changes, graph, identity, editor, repositories, settings, worktrees)
  views/        thin workflow composition screens
  lib/          typed IPC, query hooks, parsers, graph layout
  i18n/         translation bootstrap and locale resources
  state/        local UI state
src-tauri/src/
  lib.rs        capability-specific Tauri commands
  identity.rs   local Git identity profiles and repository configuration
  features.rs   remotes, comparisons, graph, stash/tag/worktree features
  git.rs        system Git boundary and real-repository fixtures
  progress.rs   streamed operations and cancellation
  db.rs         versioned local SQLite schema
  ops.rs        serialized mutation/result contract
  oplog.rs      bounded, redacted operation history
```
