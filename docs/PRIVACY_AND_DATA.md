# Privacy and local data

Gitrune is local-first. It has no Gitrune account system, hosted backend, telemetry, or analytics.

## Data processed locally

- Repository paths and display colors.
- Non-secret application settings such as theme, zoom, layout, language, editor, and terminal preferences.
- Git author-profile metadata: label, name, email, signing-key identifier, signing preference, and optional SSH Host alias.
- Redacted operation history and recovery metadata.
- Recovery copies or private Git refs created for recoverable discard.

Repository contents remain in the repositories selected by the user. Git authentication remains in system credential helpers, SSH configuration, SSH agents, or provider tooling. Gitrune does not intentionally store passwords, access tokens, or private keys.

## Backup and recovery

Back up repositories with normal Git and filesystem tools. Recovery entries are a convenience for Gitrune discard operations, not a substitute for a repository backup. Review and restore them from Operation Log before deleting application data.

## Reset and uninstall

Before resetting or uninstalling:

1. Finish or abort active Git operations.
2. Review recovery entries and restore anything required.
3. Back up repositories and any desired settings.
4. Close Gitrune.

Windows uninstallers remove the application but may retain local application data for upgrade safety. The current compatibility identifier is `dev.eduard.gitapp` and the database filename is `gitapp.sqlite`. Removal of that data is irreversible and should be performed only after locating and verifying the exact Gitrune application-data directory on the installed system.

Network access occurs only when the user requests Git network operations or when development/package tooling downloads dependencies. Future provider integrations must document any additional data flow before release.
