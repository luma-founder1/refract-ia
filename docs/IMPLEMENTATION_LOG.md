# Implementation Log

## 2026-05-04 - Hardening pass

### Goal
Close the remaining non-billing gaps in the main product flow without introducing new shortcuts or mock behavior.

### Resolved

- Normalized project status to `Refracted` after successful analysis and migrated legacy `Analysed` rows on startup.
- Prevented duplicate project records when opening or importing the same folder again.
- Moved repository clone path resolution into the main process so folder paths are built safely there instead of in the renderer.
- Added a real GitHub pull request creation flow:
  - push the applied branch to `origin`
  - create the PR through the GitHub REST API
  - open the created PR URL
- Replaced the old compare-link-only PR button with the real PR flow.
- Added a `prop-drilling` detector so the category in the UI now has a real engine behind it.
- Aligned the codemap walker with the main analysis engine limits and exposed truncation warnings in the map UI.
- Kept the billing CTA intentionally untouched, per request.

### Verification

- `npm run build` passes after the hardening changes.

### Notes

- Billing remains intentionally unresolved.
- The GitHub PR flow is implemented in code and ready for credentials and repo permissions, but it still depends on the target repository accepting pushes from the authenticated GitHub account.
