---
name: publish
description: How to publish new versions of this monorepo's packages to npm (bump → sync → build/test → review snapshots → commit+push → publish). Use when asked to publish or release a new version.
---

## How publishing works here

- **Publishing is local**, not CI. No GitHub workflow publishes; `npm run monorepo:publish` runs on your machine using tokens from `secrets.json` (git-ignored) at the repo root (`{ "NPM_TOKEN": "..." }`). Never commit that file. The token expires roughly every 3 months — an expired token is the usual cause of a failed publish run.
- **A package publishes when its `package.json` `version` is ahead of the npm registry.** `publishPackages` (from `@jsenv/monorepo`) compares each workspace package to npm and publishes only the ones that differ. It's **idempotent**: an already-published version is skipped (an `EPUBLISHCONFLICT` is treated as success), so re-running is safe.
- **`npm publish --no-workspaces` is run per package.** So each package's own `prepublishOnly` fires — notably `@jsenv/core`'s runs a **full build** (`npm run build`). That's the slow one.
- **Versions are bumped by hand** in `package.json`, then `monorepo:sync_versions` propagates them (see cascade below). There is no automatic "detect changed packages and bump" step.

## Steps

### 1. Decide what to bump (skip if already bumped)

If versions are already bumped for what needs publishing, go to step 2. Otherwise, find which packages changed since the last release and bump them:

```sh
# packages with source changes since the last "prepare release" commit
git diff --name-only <last-release-commit>..HEAD | grep '^packages/' \
  | sed -E 's#^(packages/[^/]+/[^/]+)/.*#\1#' | sort -u
# and check src/ for @jsenv/core changes
git diff --name-only <last-release-commit>..HEAD | grep '^src/'
```

Edit the `version` field in each changed package's `package.json`. Level: **patch** for fixes, **minor** for a new feature (these are `0.x`/`>=1` packages; "minor" = bump the middle number, reset patch — e.g. `0.27.86 → 0.28.0`).

### 2. Sync versions

```sh
npm run monorepo:sync_versions
```

This updates internal **pinned** dependency references to the new versions and **cascade-bumps** (patch) any package that pins a bumped one — see the cascade note below. Then **verify the real publish set** (the sync log undercounts — it prints the count from _before_ the cascade):

```sh
# packages whose OWN version changed = the true publish set
for f in $(git diff --name-only -- '**/package.json' 'package.json'); do
  old=$(git show HEAD:"$f" | node -pe "JSON.parse(require('fs').readFileSync(0)).version" 2>/dev/null)
  new=$(node -pe "require('./$f').version")
  [ "$old" != "$new" ] && echo "$(node -pe "require('./$f').name")  $old -> $new"
done
```

If the set is broader than expected (a `@jsenv/core` or `@jsenv/server` bump drags in `cli`/`fetch`/`snapshot`/`terminal-recorder`), that's normal — confirm it's intended before continuing.

### 3. Build + test

**Default (recommended): affected packages only** — much faster. For a change scoped to e.g. `@jsenv/navi`:

```sh
npm run build -w @jsenv/navi  # build just that package's dist
npm test @jsenv/navi          # test just that package
```

**Full run — only for big changes or anything touching `@jsenv/core`:**

```sh
npm run build            # builds @jsenv/core dist
npm test                 # full suite
npm run build:packages   # builds every workspace package's dist
npm run test:packages    # tests across ./packages/
```

### 4. Review snapshot changes

If tests changed snapshots, review the diff (`git diff` on the snapshot/side-effect files):

- **Expected** (new snapshots, or changes that match what you intended) → keep them.
- **Suspicious / unexplained regression** → **abort the publish** and fix the underlying issue first.

Spotting expected-vs-regression in these snapshots is usually straightforward; do it rather than skipping it.

### 5. Hand off — the user commits, pushes, and publishes

**Stop here.** Do NOT commit, push, or publish (see `.agents/instructions.md`: the user always commits, never the agent). Leave the version bumps + synced files in the working tree and tell the user what's ready. The user then runs, in order:

```sh
git add -A
git commit -m "prepare release"   # the repo's conventional message
git push                          # push before publishing, so npm matches the remote
npm run monorepo:publish          # publishes every package whose version is ahead of npm
```

## The cascade (important)

`monorepo:sync_versions` only re-versions a dependent when it references a bumped package **by a pinned version** (e.g. `"@jsenv/dom": "0.16.1"`). Dependents that use a **workspace path** (`"../dom"`, `"workspace:*"`) are left alone.

Consequence in practice:

- Bumping **`@jsenv/navi` / `@jsenv/dom`** cascades to (almost) nothing — their dependents use workspace paths.
- Bumping **`@jsenv/core` / `@jsenv/server`** cascades widely — `cli`, `fetch`, `snapshot`, `terminal-recorder` (and others) pin them by version, so each gets a patch bump and is republished to reference the new version. This is expected and safe; it's the cost of releasing a low-level package.

## Quick reference

| Command                                                  | What it does                                                                     |
| -------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run monorepo:sync_versions`                         | Propagate bumped versions into pinned deps + cascade-bump dependents             |
| `npm run build`                                          | Build `@jsenv/core` `dist/`                                                      |
| `npm test`                                               | Full test suite                                                                  |
| `npm run build:packages`                                 | Build every workspace package's `dist/`                                          |
| `npm run test:packages`                                  | Test across `./packages/`                                                        |
| `npm run build -w <pkg>` / `npm test -- ./packages/.../` | Affected-only build/test (the fast path)                                         |
| `npm run monorepo:publish`                               | Publish every package whose version is ahead of npm (local, uses `secrets.json`) |
