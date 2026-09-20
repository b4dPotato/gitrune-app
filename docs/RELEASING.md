# Release process

Gitrune is currently an unsigned Windows-first alpha. A green CI build is necessary but does not certify a release.

## Versioning

Keep `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json` on the same semantic version. During `0.x`, document breaking workflow or storage changes in `CHANGELOG.md`.

## Release candidate checklist

1. Start from a clean checkout of the intended tag.
2. Confirm pinned Node and Rust toolchains and review dependency updates.
3. Run `npm ci` and `npm run verify`.
4. Run Rust commands with `--locked` and confirm npm/Rust advisory checks and dependency-license review.
5. Build with `npm run package:windows`.
6. Verify installer and standalone archive checksums and inspect package contents for secrets and unexpected files.
7. Complete `docs/WINDOWS_SMOKE_TEST.md` on a clean Windows machine.
8. Test install, launch, upgrade, uninstall, and retained local-data behavior.
9. Update `CHANGELOG.md`, version fields, release notes, compatibility notes, and known issues.
10. Tag only the exact reviewed commit.

Do not call an archive “portable” as a guarantee that it leaves no local data; the current standalone executable still uses the normal local application-data directory. Do not present unsigned alpha artifacts as trusted production releases.

Code signing, reproducible-build certification, a generated SBOM/license report, and automatic updates remain release blockers tracked in `docs/REQUIRED_WORK.md`.
