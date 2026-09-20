# Changelog

All notable user-visible changes will be documented in this file. Gitrune follows [Semantic Versioning](https://semver.org/) once a stable public API or release channel exists. During `0.x`, minor versions may contain breaking storage or workflow changes and must include migration notes.

## [Unreleased]

## [0.1.0] - 2026-09-20

### Added

- Windows-first local Git workflow covering repository setup, changes, commits, branches, remotes, stashes, tags, worktrees, conflicts, operation history, and recovery.
- Virtualized commit graph and changed-file lists with comparison, history, and blame tools.
- Repository-local Git identity profiles, configurable themes, UI zoom, editor selection, and English, Polish, and Ukrainian localization.
- Structured errors, serialized repository mutations, bounded output, network progress, and cancellation.
- Open-source governance, security, support, licensing, and contribution documentation.

### Fixed

- Unstaging files before the repository's first commit no longer fails when `HEAD` does not exist.
- Rapid staging and unstaging are optimistically displayed and safely batched to avoid repeated blocking refreshes.

### Security

- Operation output and error details are redacted before persistence or display.
- CI performs npm and Rust advisory checks and reviews dependency changes.

[Unreleased]: https://github.com/b4dPotato/gitrune-app/commits/main
[0.1.0]: https://github.com/b4dPotato/gitrune-app/releases/tag/v0.1.0
