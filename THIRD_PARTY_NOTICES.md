# Third-party notices

Gitrune is built on open-source software. The lockfiles are the authoritative inventory of exact dependency versions:

- `package-lock.json` for JavaScript packages.
- `src-tauri/Cargo.lock` for Rust crates.

Direct JavaScript dependencies use permissive licenses:

| Package family                                                        | License           |
| --------------------------------------------------------------------- | ----------------- |
| React, React DOM                                                      | MIT               |
| TanStack React Query                                                  | MIT               |
| i18next, react-i18next                                                | MIT               |
| Tauri JavaScript API and CLI                                          | Apache-2.0 OR MIT |
| Tauri dialog plugin                                                   | MIT OR Apache-2.0 |
| TypeScript                                                            | Apache-2.0        |
| Vite, Vitest, Tailwind CSS, PostCSS, Prettier, Testing Library, jsdom | MIT               |

Direct Rust dependencies include Tauri, Serde, thiserror, rusqlite, notify, and tempfile. Their exact license expressions are published in their crate metadata and transitive versions are pinned in `src-tauri/Cargo.lock`.

The Inter font and generated font-based assets are distributed under the SIL Open Font License 1.1. The complete notice and license are stored in `docs/branding/kit/licenses/Inter-OFL.txt`.

This summary is informational and does not replace the complete license text shipped by each dependency. Automated vulnerability and dependency review runs in CI; release candidates still require a generated, reviewed software bill of materials and license report.
