import { assert } from "@jsenv/assert";

import { fetchLatestInRegistry } from "@jsenv/package-publish/src/internal/fetchLatestInRegistry.js";

const actual = await fetchLatestInRegistry({
  registryUrl: "https://registry.npmjs.org",
  packageName: "@jsenv/toto",
});
const expect = null;
assert({ actual, expect });

// if (!process.env.CI) {
//   const { resolveUrl } = await import("@jsenv/util")
//   const { loadEnvFile } = await import("./testHelper.js")

//   await loadEnvFile(resolveUrl("../../secrets.json", import.meta.url))
//   const actual = await fetchLatestInRegistry({
//     registryUrl: "https://registry.npmjs.org",
//     packageName: "@jsenv/perf-impact",
//     token: process.env.NPM_TOKEN,
//   })
//   const expect = null
//   assert({ actual, expect })
// }
