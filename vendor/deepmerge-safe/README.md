# Security-patched deepmerge

This is a local, CommonJS-compatible copy of the MIT-licensed `deepmerge`
4.3.1 bundled implementation. It replaces the package in Rollup/Workbox's
build chain through an npm override. It is not an upstream release.

Upstream advisory: https://github.com/advisories/GHSA-gcqx-w48m-w2h4
No patched upstream version was available on 6 November 2026.

The patch:

- Rejects `__proto__`, `constructor`, and `prototype` on both the target and
  source traversal, including nested objects and array elements.
- Creates destination properties with `Object.defineProperty`, never the
  legacy `__proto__` setter. The destination's prototype cannot be poisoned.
- Retains array merging, symbols, custom merge/clone options, and `.all`.

Test with `node scripts/test-dependency-security.mjs` from the repository
root. Revisit/remove this override when upstream ships an equivalent fix.
`npm audit` does not scan local package source, so the regression tests are
required; a clean audit alone is not evidence that this patch is secure.

Installation uses the committed `vendor/domashno-deepmerge-safe-1.0.0.tgz`
archive so npm installs it portably (no platform-specific symlink paths).
After editing this source, regenerate with
`npm pack ./vendor/deepmerge-safe --pack-destination vendor --ignore-scripts`.
The tests also compare the installed archive's code with this source.
