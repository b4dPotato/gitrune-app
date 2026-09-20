//! Per-repository operation locks. Mutating git operations acquire the
//! repository's lock so they run strictly sequentially; reads stay concurrent.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct RepoLocks {
    locks: Mutex<HashMap<String, Arc<Mutex<()>>>>,
}

impl RepoLocks {
    pub fn lock_for(&self, repo_path: &str) -> Arc<Mutex<()>> {
        let mut map = self.locks.lock().expect("repo locks poisoned");
        map.entry(repo_path.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn same_repo_serializes_different_repos_do_not_share_locks() {
        let locks = Arc::new(RepoLocks::default());
        let a1 = locks.lock_for("/repo/a");
        let a2 = locks.lock_for("/repo/a");
        let b = locks.lock_for("/repo/b");
        assert!(Arc::ptr_eq(&a1, &a2));
        assert!(!Arc::ptr_eq(&a1, &b));

        // serialization smoke test: two threads increment under the same lock
        let counter = Arc::new(Mutex::new(0));
        let mut handles = vec![];
        for _ in 0..4 {
            let l = locks.clone();
            let c = counter.clone();
            handles.push(thread::spawn(move || {
                let lock = l.lock_for("/repo/a");
                let _g = lock.lock().unwrap();
                let mut v = c.lock().unwrap();
                *v += 1;
            }));
        }
        for h in handles {
            h.join().unwrap();
        }
        assert_eq!(*counter.lock().unwrap(), 4);
    }
}
