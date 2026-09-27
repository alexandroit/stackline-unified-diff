# Changelog

## 1.0.0

- Use @stackline/git-diff-tree 1.0.0 to remove deprecated stream dependencies while preserving the unified plugin.
- Skip binary and mode-only changes without text hunks instead of dereferencing an absent first line.
- Retain the upstream CI filtering scenarios with native test and temporary Git fixture setup.
