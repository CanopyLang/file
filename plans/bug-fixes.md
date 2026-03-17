# canopy/file — Upstream Bug Fixes

From elm-janitor/file stack-1.0.5.

---

## iOS Safari Blob Download Broken (HIGH)

- [ ] **Defer `URL.revokeObjectURL` to next event loop tick.** (elm/file#21, elm/file#17)
  File downloads are completely broken on iOS Safari. The `URL.revokeObjectURL` is called immediately (synchronously) after triggering the download click, but iOS Safari needs the object URL to remain valid for at least one event loop tick.
  Fix: wrap `URL.revokeObjectURL(objectUrl)` in `setTimeout(function(){ ... })`.
  **File:** `src/Elm/Kernel/File.js` (Kernel JS)
