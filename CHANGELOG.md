# Changelog

## 1.0.2 (2026-09-28)

- Standardize package documentation, preserve the API reference and upstream attribution, and add Stackline community links.
- Add focused npm discovery keywords and consistent repository metadata.
- Keep runtime behavior and dependency versions unchanged.
- Correct the pinned artifact-upload action commit while preserving the publish.yml workflow and Prod environment.

## 1.0.1

- Count new-file line positions from each Git hunk header. Removed lines and no-newline markers no longer shift diagnostics away from replacements.
- Preserve only added-line diagnostics across multiple hunks, including context, blank lines, new files and deletion-only changes.
- Add nine real Git regression scenarios covering the inherited upstream line-accounting defect.

## 1.0.0

- Use @stackline/git-diff-tree 1.0.0 to remove deprecated stream dependencies while preserving the unified plugin.
- Skip binary and mode-only changes without text hunks instead of dereferencing an absent first line.
- Retain the upstream CI filtering scenarios with native test and temporary Git fixture setup.
