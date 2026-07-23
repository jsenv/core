---
name: dependency-updates
description: How dependencies, package versions, and publishing are handled in this monorepo. Use when updating npm dependencies, bumping a package's version, syncing versions across packages, or publishing to npm.
---

## Updating dependencies

Run `npm outdated` and update everything it lists — including major versions, that's expected and fine here.

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
