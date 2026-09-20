//! Capability-oriented Tauri command adapters.
//!
//! Git behavior remains in crate-private services while this layer gives every
//! IPC capability a small, discoverable module and prevents a generic shell API.

pub(super) mod branch;
pub(super) mod changes;
pub(super) mod commit;
pub(super) mod conflict;
pub(super) mod history;
pub(super) mod remote;
pub(super) mod repository;
pub(super) mod stash;
pub(super) mod tag;
pub(super) mod worktree;
