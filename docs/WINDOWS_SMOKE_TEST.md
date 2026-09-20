# Windows desktop smoke test

Run this checklist against the packaged executable, using disposable repositories and a local bare remote. Do not use a repository containing irreplaceable work.

- [ ] Launching Gitrune opens one application window and no persistent console windows.
- [ ] Closing the application removes the Gitrune process and any Git process started by it.
- [ ] Open an existing repository and initialize and clone disposable repositories.
- [ ] Edit a file, stage selected lines and a hunk, unstage them, and commit.
- [ ] Create and switch branches; merge and rebase non-conflicting changes.
- [ ] Add a local bare remote, publish a branch, fetch, pull with merge/rebase, and push.
- [ ] Enable **Push after commit** and verify that an unpublished branch is published with its upstream configured.
- [ ] Verify that push-after skips pushing and explains the required action when the upstream is ahead.
- [ ] Stash, inspect, apply, pop, drop, and create a branch from a stash.
- [ ] Create merge, rebase, cherry-pick, and revert conflicts; resolve, continue, and abort them.
- [ ] Discard tracked, untracked, Unicode, and spaced-path files; restore each recovery from Operation Log.
- [ ] Verify that restore refuses to overwrite newer content and does not partially restore other files.
- [ ] Undo an unpublished commit and confirm its changes remain staged.
- [ ] Attempt to undo or amend a published commit and verify that the history-rewrite confirmation appears.
- [ ] Cancel a long-running clone or fetch and verify that its Git process exits and the operation is logged as cancelled.
- [ ] Restart Gitrune and verify repository colors, theme, zoom, panel sizes, editor, and terminal settings.
