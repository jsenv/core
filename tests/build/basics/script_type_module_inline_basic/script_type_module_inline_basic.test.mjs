import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

import { build } from "@jsenv/core";

const test = async ({ name, ...params }) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
};

// cannot use <script type="module">
await test({
  name: "0_js_module_fallback",
  runtimeCompat: { chrome: "60" },
  versioning: false,
});