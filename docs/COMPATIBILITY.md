# Compatibility and support matrix

Gitrune is an early alpha. “Targeted” means the project intends to support the configuration and has automated coverage; it does not replace the required clean-machine smoke test.

| Area                                                         | State                                   | Notes                                                                                                                 |
| ------------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Windows 10/11 x64                                            | Targeted, not yet certified             | Requires WebView2, Git 2.31+, and the Windows smoke checklist.                                                        |
| Normal and unborn repositories                               | Targeted                                | Real-repository tests cover both, including first-commit staging and unstaging.                                       |
| Local bare remotes                                           | Targeted for tests                      | Used for offline fetch/pull/push fixtures.                                                                            |
| Linked worktrees                                             | Targeted                                | Basic create/list/remove safety is implemented.                                                                       |
| Multiple remotes and non-`origin` defaults                   | Targeted                                | Advanced triangular and separate fetch/push URL certification remains.                                                |
| Unicode and spaced paths                                     | Targeted                                | Covered by real Git fixtures. Tabs, newlines, long paths, UNC paths, and case-only renames remain certification work. |
| macOS and Linux source builds                                | Detected but unsupported                | Code is intended to remain portable, but builds and desktop behavior are not certified.                               |
| Browser demo mode                                            | UI preview only                         | It cannot read repositories or execute Git.                                                                           |
| Bare repositories, corrupt repositories, unusual filesystems | Unsupported until detection is complete | Do not use Gitrune to mutate them.                                                                                    |
| Git older than 2.31                                          | Unsupported                             | The app does not yet preflight and explain every unsupported version.                                                 |
| GitHub OAuth, pull requests, notifications                   | Out of scope for the local MVP          | Preview UI is hidden outside explicit demo mode.                                                                      |

Authentication is delegated to system Git credential helpers and SSH configuration. Provider behavior, protected branches, enterprise hosts, proxies, and credential-helper variants require separate testing.

See [REQUIRED_WORK.md](REQUIRED_WORK.md) for the full certification backlog.
