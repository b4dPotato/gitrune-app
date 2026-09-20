# Local-first architecture

Gitrune is a desktop application. It does not require a Gitrune account or a hosted Gitrune backend.

## Local responsibilities

- The Tauri Rust process is a native backend bundled inside the desktop application, not a remote service.
- The installed system Git performs repository operations and continues to use the user's Git configuration, SSH agent, and credential helpers.
- SQLite stores local application metadata: known repository paths, UI settings, recovery metadata, operation history, and reusable Git author profiles.
- Author profiles contain a label, commit name/email, optional signing-key identifier, signing preference, and optional SSH `Host` alias. They never contain tokens, passwords, private keys, or key material.
- Applying a profile writes only repository-local `user.name`, `user.email`, `user.signingkey`, and `commit.gpgsign` values. Git authentication is still delegated to system Git, its configured credential helpers, SSH configuration, and SSH agent.

## Deferred GitHub integration

The current release has no GitHub API integration. GitHub accounts and pull requests remain hidden outside explicit demo mode; local Git Profiles are available normally. A later milestone may communicate directly with GitHub's REST and GraphQL APIs over HTTPS.

GitHub device authorization does not require a client secret, but GitHub does require a public client ID from a registered OAuth or GitHub App with device flow enabled. This is provider-side application registration, not user registration in Gitrune and not a hosted backend.

The possible future authorization sequence is:

1. The desktop app requests a device code from GitHub.
2. The user approves the code on GitHub in their browser.
3. The desktop app polls GitHub at the required interval.
4. The resulting token is stored in the OS credential store.
5. The desktop app calls GitHub directly using that token.

No Gitrune server receives repositories, tokens, profile rules, or operation history.

## Optional provider adapters

The account layer should remain an adapter boundary. A future implementation can support GitHub Enterprise hosts or reuse an authenticated GitHub CLI installation without changing local Git operations.
