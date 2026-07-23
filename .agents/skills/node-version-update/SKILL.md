---
name: node-version-update
description: How to check for and apply a Node.js version upgrade in this monorepo. Use when asked to update/upgrade the Node.js version, or to check whether a newer Node.js is available.
---

## Policy

Stay on the latest available Node.js version — not necessarily the LTS line.
Node.js alternates release lines: even majors eventually become LTS, odd
majors are "Current" only. We track whichever is actually newest overall, not
specifically the LTS one. It's fine to proactively move to an alpha/beta if
there's a reason to, but that's not the normal case — normally just the
latest already-released version is what we want.

## Checking for a newer version

```sh
volta fetch --verbose node@latest
```

The `--verbose` output includes a line like:

```
[verbose] Found latest node version (X.Y.Z) from https://nodejs.org/dist/index.json
```

Compare `X.Y.Z` against the `"volta": { "node": ... }` field in the root
`package.json`. If they match, there's nothing to do. If a newer version is
available, proceed below.

Don't use `node@current` — it isn't a valid tag for volta (it'll error with
"Could not find Node version matching..."). `node@latest` is what correctly
resolves to the actual newest release, matching nodejs.org's own dist index
— which is what we want (not tied to the LTS line specifically).

## Applying the upgrade

```sh
volta pin node@latest
```

This is the command that actually updates the root `package.json`'s
`"volta": { "node": ... }` field (unlike `volta install`, which only adds the
version to the local toolchain without touching the project's pin).

## Updating GitHub workflows

Node's version is also hardcoded in several workflow files' test matrices —
`volta pin` does not touch these, they need a manual update:

```sh
grep -rn "node:\s*\[" .github/workflows/
```

Update each `node: [X.Y.Z]` entry to match the new pinned version. Check
first whether any workflow is deliberately pinned to a different version on
purpose (e.g. testing against the minimum supported Node from `engines` in
package.json, or an older baseline) before overwriting it — not every
workflow file necessarily tracks "latest".
