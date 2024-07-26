import { build } from "@jsenv/core";
import { snapshotBuildSideEffects } from "@jsenv/core/tests/snapshot_build_side_effects.js";

const test = async (scenario, options) => {
  await snapshotBuildSideEffects(
    () =>
      build({
        logLevel: "info",
        sourceDirectoryUrl: new URL("./client/", import.meta.url),
        buildDirectoryUrl: new URL("./build/", import.meta.url),
        entryPoints: {
          "./main.html": "main.html",
        },
        outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
        ...options,
      }),
    new URL(`./output/${scenario}.md`, import.meta.url),
    {
      filesystemEffects: {
        baseDirectory: new URL("./", import.meta.url),
      },
    },
  );
};

// can use <script type="module">
await test("0_js_module", {
  runtimeCompat: { chrome: "89" },
  bundling: false,
  minification: false,
  versioning: false,
});

// cannot use <script type="module">
// await test("1_js_module_fallback", {
//   runtimeCompat: { chrome: "60" },
//   bundling: false,
//   minification: false,
//   versioning: false,
// });
