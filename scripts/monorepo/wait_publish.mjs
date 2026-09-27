/*
 * Wait until the versions found in package.json files are published on npm
 * (by .github/workflows/publish.yml once the "[publish]" commit is pushed)
 */

import { waitForPackagesPublication } from "@jsenv/monorepo";

await waitForPackagesPublication({
  directoryUrl: new URL("../../", import.meta.url),
});
