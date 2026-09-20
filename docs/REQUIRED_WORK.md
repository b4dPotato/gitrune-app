# Required work

This is the completion backlog for Gitrune's local-first desktop product. It is deliberately separate from feature ideas so release-critical work is not hidden by UI polish.

## Scope

- [x] Keep the application local-first. Repositories, Git configuration, SSH keys, and credentials remain on the user's machine.
- [x] Use the system Git executable, credential helpers, and SSH configuration.
- [ ] Finish and certify the Windows daily-use release before widening platform support.
- [ ] Push or publish the project to a hosting provider. This is the only release task intentionally deferred by the project owner.
- [ ] Provider-specific P2 features (GitHub OAuth/API, pull requests, notifications, and advanced named workspaces) remain out of scope.

## M0 — Supported product boundary

- [x] Publish a compatibility matrix with **certified**, **detected but unsupported**, and **out of scope** states.
- [ ] Certify normal and unborn repositories, linked worktrees, multiple remotes, mixed index/worktree changes, Unicode and spaced paths, leading-dash paths, long paths, and case-only renames.
- [ ] Detect bare or corrupt repositories, unsupported filesystems, and unsupported Git versions without mutating them.
- [ ] Document the minimum Git, Windows, and WebView2 versions and how the app reports missing prerequisites.

## M1 — Legal, governance, and repository hygiene

- [x] Choose and add an application license. Apache-2.0 is the recommended permissive default; GPL-3.0-or-later is the alternative if derivative applications must remain open.
- [x] Add `NOTICE`, `THIRD_PARTY_NOTICES`, a `LICENSES/` directory, package/Cargo license metadata, and SPDX identifiers where appropriate.
- [x] Document licenses for documentation, fonts, icons, generated brand assets, and the project name/trademark policy.
- [x] Add `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, `CHANGELOG.md`, an architecture guide, and a coding guide.
- [x] Add issue templates and a pull-request template.
- [x] Add privacy, backup, recovery, reset, and uninstall documentation.
- [ ] Establish a clean tracked baseline; remove or relocate the stale root package archive after confirming it is not needed.
- [x] Add and verify `.editorconfig`, `.gitattributes`, generated-file policy, and ignores for build artifacts, local data, and secrets.
- [ ] Prove that a clean checkout builds and tests without untracked local dependencies.

## M2 — Git correctness and data safety

- [x] Fix unstaging in unborn repositories where `git restore --staged` has no `HEAD`.
- [ ] Support leading-dash paths safely by using argument arrays and `--`, rather than rejecting valid filenames.
- [ ] Test tabs, newlines, unusual Unicode, case-only renames, Windows long paths, and UNC paths.
- [ ] Test deletes, renames, copies, executable bits, symlinks, submodules, intent-to-add, skip-worktree, sparse checkouts, shallow clones, and partial clones.
- [ ] Canonicalize repository paths and define safe junction/symlink traversal behavior.
- [ ] Cover modify/delete, delete/delete, rename, add/add, binary, and submodule conflicts, including missing index stages.
- [ ] Verify merge/rebase `ours` and `theirs` semantics, active-operation validation, marker-like file content, continue, and abort.
- [ ] Cover multiple and non-`origin` remotes, separate fetch/push URLs, triangular workflows, stale upstreams, local/UNC remotes, SSH ports, and HTTPS credential helpers.
- [ ] Handle offline, DNS, timeout, protected-branch, non-fast-forward, stale force-with-lease, signing, and hook failures with actionable errors.
- [ ] Ensure cancellation cannot leave orphan Git processes or locks.
- [ ] Handle disk-full, permission, index-lock, and process-crash recovery; mark interrupted operations on the next launch.
- [ ] Add recovery retention, database backup, transactional migration, and corruption-recovery policies.

## M3 — Accessibility

- [ ] Adopt WCAG 2.2 AA as the desktop UI target.
- [ ] Replace clickable non-semantic elements with buttons, links, listboxes, or options as appropriate.
- [ ] Add complete keyboard navigation for lists, menus, dropdowns, the command palette, and the commit graph (arrows, Home/End, Enter, and Escape).
- [ ] Add `aria-expanded`, `aria-controls`, `aria-current`, `aria-selected`, and accessible icon names where applicable.
- [ ] Trap and restore focus in modal dialogs and make background content inert.
- [ ] Announce toasts, operation progress, errors, and status changes through correctly scoped live regions.
- [ ] Keep interactive targets at least 24×24 CSS pixels and certify contrast for built-in and custom themes.
- [ ] Certify 200% zoom, Windows forced-colors mode, reduced motion, and text selection.
- [ ] Add automated axe checks, keyboard interaction tests, and a manual NVDA test checklist.

## M4 — Maintainability and performance

- [x] Establish documented dependency/component rules, shared screen primitives, feature-owned Changes/Graph/Branches/Overview/Conflicts components, and one formatter configuration.
- [ ] Complete the component refactor described in `REFACTORING_GUIDE.md`; keep views as composition roots.
- [ ] Move the remaining specialist workflow copy to semantic i18n keys and have Polish/Ukrainian translations reviewed by native speakers.
- [ ] Split oversized TypeScript transport/hooks modules and the Rust command module by capability.
- [x] Bound every Git command's captured output and stream or page large diffs, history, blame, and file lists.
- [ ] Add large-repository fixtures (target: 100k paths and long histories) and performance budgets.
- [ ] Watch active repositories only; define junction, symlink, overflow, and watcher-restart behavior. Active-repository watching and ignored build trees are implemented; junction/overflow/restart behavior remains.
- [x] Scope query invalidation by repository and operation instead of broadly refreshing unrelated data.
- [ ] Bound caches, operation logs, and recovery metadata with visible retention controls.
- [ ] Measure startup time, graph time-to-first-row, diff load time, and steady-state memory.
- [ ] Add ESLint (including React and accessibility rules), Prettier, coverage thresholds, migration tests, and real capability tests.
- [ ] Add Rust advisory and dependency-license checks.

## M5 — Release engineering

- [x] Keep npm, Cargo, and Tauri versions synchronized and document semantic-versioning rules.
- [x] Add a release checklist and changelog generation policy.
- [x] Build Rust with `--locked`; pin Node and Rust toolchains and document dependency-update policy.
- [x] Pin CI actions by immutable commit SHA.
- [x] Run JavaScript and Rust vulnerability checks and license-policy checks in CI.
- [ ] Generate an SBOM, artifact checksums, and a machine-readable release manifest.
- [ ] Test clean-machine install/uninstall, upgrade, failed upgrade, and supported downgrade behavior.
- [ ] Add an About/Diagnostics screen with exact app, Git, OS, WebView, database, and log-path versions.
- [ ] Detect prerequisites before launching Git workflows.
- [x] Add Authenticode signing for trusted releases, or label unsigned alpha builds clearly.
- [ ] Include license notices, manifest, SBOM, and checksums in portable packages; call them “standalone” until settings/data are truly portable.
- [ ] Generate and verify release artifacts locally. Uploading them is deferred.

## M6 — Release certification gate

- [ ] Legal and governance files are complete and reviewed.
- [ ] A clean checkout passes all build, test, formatting, audit, license, and migration checks.
- [ ] Certified Git edge cases pass and unsupported cases fail safely without data loss.
- [ ] Automated accessibility checks and the manual keyboard/NVDA checklist pass.
- [ ] SBOMs, checksums, installers, and standalone archives are reproducible and verified.
- [ ] Install, upgrade, uninstall, portable-data, recovery, and Windows smoke tests pass.
- [ ] No secrets, orphan processes, unexpected shells, or unbounded logs are present in release artifacts.
