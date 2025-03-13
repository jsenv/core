import { build } from "@jsenv/core";
// import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const jsenvPluginPrebuild = async ({
  sourceDirectoryUrl,
  buildDirectoryUrl,
  entryPoints,
  ...rest
}) => {
  const buildPromise = build({
    logs: {
      level: "warn",
      disabled: true,
    },
    sourceDirectoryUrl,
    buildDirectoryUrl,
    entryPoints,
    ...rest,
  });
  const entryPointBuildUrlMap = new Map();
  const entryPointSourceUrlSet = new Set();
  const entryPointBuildUrlSet = new Set();
  for (const key of Object.keys(entryPoints)) {
    const entryPointUrl = new URL(key, sourceDirectoryUrl).href;
    const entryPointBuildUrl = new URL(entryPoints[key], buildDirectoryUrl)
      .href;
    entryPointBuildUrlMap.set(entryPointUrl, entryPointBuildUrl);

    entryPointSourceUrlSet.add(entryPointUrl);
    entryPointBuildUrlSet.add(entryPointBuildUrl);
  }

  await buildPromise;

  return {
    name: "jsenv:prebuild",
    redirectReference: (reference) => {
      const entryPointBuildUrl = entryPointBuildUrlMap.get(reference.url);
      if (!entryPointBuildUrl) {
        return null;
      }
      console.log("redirecting", reference.url, "to", entryPointBuildUrl);
      return entryPointBuildUrl;
    },
    fetchUrlContent: async (urlInfo) => {
      if (!entryPointBuildUrlSet.has(urlInfo.url)) {
        return null;
      }
      console.log("fetching", urlInfo.url);
      return null;
    },
  };
};

const run = async () => {
  await build({
    logs: {
      disabled: true,
    },
    sourceDirectoryUrl: import.meta.resolve("./source/"),
    buildDirectoryUrl: import.meta.resolve("./build/"),
    entryPoints: { "./index.js": "index.js" },
    runtimeCompat: {
      node: "20",
    },
    bundling: false,
    minification: false,
    versioning: false,
    // bundling: false,
    plugins: [
      await jsenvPluginPrebuild({
        sourceDirectoryUrl: import.meta.resolve("./source/"),
        buildDirectoryUrl: import.meta.resolve("./build/client/"),
        base: "/client/",
        entryPoints: {
          "./client/main.html": "main.html",
        },
        bundling: false,
        minification: false,
        versioning: false,
      }),
    ],
  });
};

await run();
// await snapshotBuildTests(import.meta.url, ({ test }) => {
//   test("0_basic", () => run());
// });
