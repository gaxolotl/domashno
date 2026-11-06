# Dependency security

Install/update using the committed lockfile: `npm ci`. Use Node 22 LTS.
On the VPS run npm as the `domashno` service user, not root.

Checks:

```sh
npm run audit
npm run test:security
npm run build
npm --workspace web run typecheck
```

The security tests use isolated temporary databases, never the production
database or uploaded files.

## Current overrides

- Workbox's `glob` is pinned to 14.0.4. Earlier releases contain the
  AbortSignal cancellation issue GHSA-3g3m-2fjr-6pw4; this also brings in
  patched `minimatch` 11.x. PWA generation has been verified under Node 22.
- Rollup's `deepmerge` is replaced with the documented local security patch
  in `vendor/deepmerge-safe/`. No upstream security patch was available as of
  6 November 2026. The installed archive is checked against the source and
  tested for prototype poisoning, including target/source, nesting, and arrays.

`npm audit` checks known advisories, not application code or local vendor
source. A clean audit is not a guarantee of the absence of vulnerabilities.
Revisit these overrides when upstream ships compatible fixes.
