# Refactoring guide

These rules define the intended architecture for Gitrune. A refactor is complete only when it improves these boundaries without changing Git behavior unintentionally.

## Dependency direction

1. `views/` are composition roots. They select data and arrange feature components; they do not implement reusable controls or Git algorithms.
2. `features/<capability>/` owns the capability's UI, workflow-specific hooks, validation, and presentation helpers.
3. `components/ui/` contains domain-agnostic primitives. It must not import Git types, IPC, or feature code.
4. `components/layout/` contains application shell and reusable page-layout primitives.
5. `lib/` contains typed transport, normalized errors, query hooks, and pure shared utilities. React components must not be defined there.
6. Rust Tauri commands are thin adapters over testable Git/database services. Git remains the source of truth.

Dependencies point inward: views may use features, features may use shared UI/lib, and shared UI must never import a feature or view.

## Components and files

- Prefer one exported React component per file, with the filename matching the component.
- Keep a helper local only when it is small, private to that component, and makes the main render easier to read.
- Target views below 150 lines, components below 200 lines, and hooks below 150 lines. Split by responsibility, not arbitrary line counts.
- Format JSX across lines. Dense one-line component trees are not considered maintainable.
- Reuse one feature action/modal for the same workflow everywhere (for example stash apply, branch creation, or destructive confirmation).
- Use typed, explicit props and discriminated unions. Do not introduce `any`; handle unions exhaustively.

## State and data

- Keep transient state at the nearest common owner.
- Use TanStack Query for Git/server-shaped state and query invalidation; use the app store for shell selection/layout only.
- Persist only real user settings in SQLite. Never store credentials or repository contents.
- Put Git policy and safety validation in the Rust backend so every UI entry point has identical behavior.
- Every mutation must surface the normalized operation result/error and refresh only affected repository queries.

## Accessibility and interaction

- Use semantic elements before ARIA. Every icon-only action has a visible tooltip and accessible name.
- Dialogs have a label, keyboard dismissal, focus containment, and focus restoration.
- Keyboard and screen-reader behavior is part of a component's definition, not a later polish pass.
- Use the shared action, modal, form, empty-state, and screen-header primitives for consistent sizing and feedback.

## Internationalization

- New user-facing prose must use an i18n key. Do not translate command lines, paths, SHAs, ref names, or raw Git output.
- Keys are semantic and feature-scoped (`changes.commit`, not `greenButtonText`).
- Use interpolation and plural rules; never assemble translated sentences from fragments.
- English is the complete fallback language. Other locales may fall back per key while translations are completed.
- Persist the chosen language locally and allow changing it without restarting.

## Testing and performance

- Test user-observable behavior and safety decisions. Keep pure parsing/selection logic separate for fast unit tests.
- Add a regression test before changing a risky Git workflow.
- Do not add memoization without a measured reason. Virtualize or page lists that can grow with repository history.
- Bound command output, caches, logs, and recovery data.

## Security

- Execute programs with validated executable paths and argv arrays; never interpolate user data into a shell command.
- Validate again at the backend boundary even when the UI validates.
- Redact credentials and tokens from logs, errors, operation history, and diagnostics.
- Keep system credential helpers and SSH configuration external to the application.

## Refactor workflow

1. Characterize current behavior with tests.
2. Extract one responsibility at a time without changing behavior.
3. Replace duplication with the shared component or hook.
4. Add accessibility and translations at the extracted boundary.
5. Run focused tests, then the complete verification pipeline.
