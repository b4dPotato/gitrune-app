//! Secret redaction. Applied to every string that reaches the operation log
//! or an error payload. Rule: tokens, passwords and key material never leave
//! the backend unredacted.

const MARKERS: &[&str] = &[
    "ghp_",
    "gho_",
    "ghu_",
    "ghs_",
    "ghr_", // GitHub token prefixes
    "github_pat_",
];

pub fn redact(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for line in input.split_inclusive('\n') {
        out.push_str(&redact_line(line));
    }
    out
}

fn redact_line(line: &str) -> String {
    let mut s = line.to_string();

    // token-like markers: replace the token that follows the marker
    for m in MARKERS {
        while let Some(idx) = s.find(m) {
            let end = s[idx..]
                .find(|c: char| !(c.is_ascii_alphanumeric() || c == '_'))
                .map(|e| idx + e)
                .unwrap_or(s.len());
            s.replace_range(idx..end, "[REDACTED]");
        }
    }

    // URL basic-auth credentials: scheme://user:pass@host
    if let Some(scheme_end) = s.find("://") {
        let rest_start = scheme_end + 3;
        if let Some(at_rel) = s[rest_start..].find('@') {
            let at = rest_start + at_rel;
            let creds = &s[rest_start..at];
            if creds.contains(':') || !creds.is_empty() {
                // only redact if it looks like credentials (no slash before @)
                if !creds.contains('/') {
                    s.replace_range(rest_start..at, "[REDACTED]");
                }
            }
        }
    }

    // Authorization header values can contain spaces (for example "Bearer token"),
    // so redact the entire value while preserving the line ending.
    if let Some(idx) = s.to_ascii_lowercase().find("authorization:") {
        let value_start = idx + "authorization:".len();
        let value_end = s.trim_end_matches(['\r', '\n']).len();
        if value_end > value_start {
            s.replace_range(value_start..value_end, " [REDACTED]");
        }
    }

    // `password=...` / `token=...` style key-value pairs
    for key in ["password=", "token="] {
        if let Some(idx) = s.to_ascii_lowercase().find(key) {
            let val_start = idx + key.len();
            let end = s[val_start..]
                .find(|c: char| c.is_whitespace())
                .map(|e| val_start + e)
                .unwrap_or(s.len());
            if end > val_start {
                s.replace_range(val_start..end, "[REDACTED]");
            }
        }
    }

    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_github_tokens() {
        let out = redact("fatal: auth failed for token ghp_AbC123xyz789 retry");
        assert!(!out.contains("ghp_AbC123xyz789"));
        assert!(out.contains("[REDACTED]"));
    }

    #[test]
    fn redacts_url_credentials() {
        let out = redact("cloning https://user:hunter2@github.com/acme/repo.git");
        assert!(!out.contains("hunter2"));
        assert!(out.contains("github.com/acme/repo.git"));
    }

    #[test]
    fn redacts_key_value_secrets() {
        let out = redact("using token=abcdef123 for auth");
        assert!(!out.contains("abcdef123"));
    }

    #[test]
    fn redacts_bearer_authorization_headers() {
        let out = redact("Authorization: Bearer secret-value\nnext line");
        assert!(!out.contains("secret-value"));
        assert_eq!(out, "Authorization: [REDACTED]\nnext line");
    }

    #[test]
    fn leaves_normal_output_alone() {
        let msg = "3 files changed, 64 insertions(+), 18 deletions(-)";
        assert_eq!(redact(msg), msg);
    }
}
