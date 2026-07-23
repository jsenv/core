---
name: dependency-updates
description: How dependencies, package versions, and publishing are handled in this monorepo. Use when updating npm dependencies, bumping a package's version, syncing versions across packages, or publishing to npm.
---

## Updating dependencies — the steps, in order

1. Run `npm outdated` and update everything it lists — including major versions,
   that's expected and fine here — **except `eslint`/`babel` and their plugins**
   (see below).
2. While doing so, bump the patch version of any of our own packages whose real
   dependency (not devDependency) changed — see "Bumping a package's own
   version" below.
3. Run `npm install` to refresh `node_modules` against the updated
   `package.json` files.
4. **Stop here and hand off to the human.** Don't run builds or the test suite
   yourself at this point — say the updates are applied and ask them to review
   the diff and verify things still work (builds, some or all tests) before
   going further. Also flag explicitly that `eslint`/`babel` were *not*
   auto-updated: bringing those forward is its own dedicated, longer task (their
   plugin ecosystems usually aren't ready yet, so it has a good chance of not
   working outright) — not something to fold into a routine dependency bump.

**Exception: `eslint`/`babel` and their plugins.** These tend to ship large breaking changes, and their plugin ecosystems typically lag behind a new major by weeks or months. Wait until the plugins you actually use are compatible before upgrading these.

## Bumping a package's own version

If a package's dependency got bumped to a newer version, bump that package's own patch version too. Not needed if it was only a devDependency.

## Syncing versions across the monorepo

```sh
npm run monorepo:sync_versions
```

Bumps the version of any package that hasn't been published yet at its current number, along with everything that depends on it.

## Publishing

```sh
npm run monorepo:publish
```

Publishes every package that isn't already published at its current version.

Requires a valid npm token in `secrets.json` at the repo root (`{ "NPM_TOKEN": "..." }`, gitignored — never commit it). Refresh it roughly every 3 months; an expired token is the usual cause of a failed publish run.

Publishing itself is the human's call: they either run `monorepo:publish` themselves, or ask the AI to publish a new version, in which case this is the command to use.

## Why there's no package-lock.json

A committed lockfile breaks in some environments — notably GitHub Actions on Linux ending up with the wrong platform-specific deps. The usual culprits are `rollup` and `lightningcss`, which ship OS-specific compiled binaries; npm doesn't currently handle that well across platforms in a shared lockfile. Versions are pinned directly in each package's `package.json` instead.
