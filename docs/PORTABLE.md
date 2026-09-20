# Gitrune standalone build

Run `Gitrune.exe` directly. Installation and a Gitrune account are not required.

The archive filename retains `portable` for compatibility with earlier builds. The application still stores settings and recovery metadata in the normal Windows application-data directory, so it is not a fully self-contained portable-data installation.

Requirements:

- Windows 10 or 11 with the Microsoft Edge WebView2 runtime.
- Git 2.31 or newer available on `PATH`.
- Your existing Git credential helper, SSH configuration, and SSH agent remain responsible for authentication.

Gitrune stores its local settings, registered repository paths, operation log, and recovery metadata in the normal Windows application-data directory. Removing this folder does not delete any Git repository.

This build is unsigned. Windows SmartScreen may display an unrecognized-app warning.

The archive includes Apache-2.0 and third-party notices plus a release manifest containing the executable checksum. Verify the archive against its adjacent `.sha256` file before running it.
