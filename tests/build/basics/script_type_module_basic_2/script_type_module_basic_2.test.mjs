import { build } from "@jsenv/core";

import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async ({ name, ...rest }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...rest,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
};

// can use <script type="module">
await test({
  name: "0_js_module",
  runtimeCompat: { chrome: "89" },
  versioning: true,
});
// cannot use <script type="module">
await test({
  name: "1_js_module_fallback",
  runtimeCompat: { chrome: "60" },
  versioning: true,
});
// can use <script type="module"> + sourcemap
await test({
  name: "2_js_module_sourcemaps_file",
  runtimeCompat: { chrome: "89" },
  versioning: true,
  sourcemaps: "file",
});