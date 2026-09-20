# Building Gitrune from source

Gitrune must be built natively on the operating system it will run on. Windows is the currently tested and packaged target. macOS and Linux builds are experimental and have not completed platform smoke testing.

## Common requirements

- Git 2.31 or newer.
- Node.js 22.19 or newer and npm 10.9 or newer. The expected Node version is recorded in `.nvmrc`.
- Rust 1.97 through `rustup`. The repository's `rust-toolchain.toml` selects the expected toolchain automatically.

Clone and install the locked JavaScript dependencies:

```bash
git clone https://github.com/b4dPotato/gitrune-app.git
cd gitrune-app
npm ci
```

Run the project checks before packaging:

```bash
npm run verify
```

## Windows 10/11 (supported build host)

Install:

- Microsoft Visual Studio Build Tools with **Desktop development with C++** and a Windows SDK.
- Microsoft Edge WebView2 Runtime. It is normally already present on current Windows 10/11 systems.
- The Windows **VBSCRIPT** optional feature if MSI creation reports a `light.exe` error.

Build NSIS and MSI installers plus the standalone ZIP from PowerShell:

```powershell
npm run package:windows
```

Outputs:

- `src-tauri/target/release/bundle/nsis/*-setup.exe` — recommended installer.
- `src-tauri/target/release/bundle/msi/*.msi` — MSI installer.
- `artifacts/Gitrune-<version>-windows-x64-portable.zip` — standalone executable and notices. Despite the historical filename, settings are stored in normal application data.

## macOS (experimental)

Install Xcode Command Line Tools:

```bash
xcode-select --install
```

Then build the application bundle and DMG on the Mac that will run them:

```bash
npm ci
npm run verify
npm run tauri -- build --bundles app,dmg
```

Outputs are under `src-tauri/target/release/bundle/`. Public macOS distribution additionally requires Apple code signing and notarization. An unsigned local build may be blocked by Gatekeeper.

## Linux (experimental)

Install the Tauri 2 system packages for your distribution. On current Debian/Ubuntu systems this typically includes:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

Then build Debian and AppImage packages:

```bash
npm ci
npm run verify
npm run tauri -- build --bundles deb,appimage
```

Outputs are under `src-tauri/target/release/bundle/`. Linux packages depend on the distribution's WebKitGTK and system libraries; build on the oldest distribution version you intend to support.

For other Linux distributions and current package names, follow the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/). Tauri's [distribution guide](https://v2.tauri.app/distribute/) documents additional bundle formats and signing.

## Development mode

After installing the platform prerequisites:

```bash
npm run tauri dev
```

The browser-only Vite server cannot access local Git repositories. Use `VITE_DEMO_MODE=true npm run dev` only for UI preview work.

## Platform status

See the [compatibility matrix](COMPATIBILITY.md) before distributing a build. A successful compilation does not mean that macOS or Linux is certified; editor/terminal discovery, filesystem watching, packaging, signing, and complete Git workflows still require platform smoke testing.
