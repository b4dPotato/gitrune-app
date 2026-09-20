# Generated-file policy

Commit source inputs and the generated assets required to build or review Gitrune. Do not commit local build output, caches, downloaded dependencies, application databases, recovery data, or packaged binaries.

Tracked generated assets include the reviewed branding kit and Tauri icons because the build consumes them directly and their generation requires design tooling. Their source prompts, SVG masters, manifest, validation notes, and license information must remain beside them.

Ignored generated paths include:

- `node_modules/` and `dist/`.
- `src-tauri/target*/` and `src-tauri/gen/`.
- `artifacts/`, coverage output, TypeScript build metadata, local environment files, and credentials.
- The legacy root source archive `GIT_App_Claude_Package.zip`.

Release artifacts are produced by CI or the documented packaging scripts and attached to releases rather than committed to the source tree.
