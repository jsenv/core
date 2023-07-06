import { jsenvPluginBundling } from "@jsenv/plugin-bundling";

import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async (name, params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL(`./snapshots/${name}/`, import.meta.url),
  );
};

if (process.platform === "darwin") {
  // support + bundling
  await test("1", {
    runtimeCompat: { chrome: "80" },
    plugins: [jsenvPluginBundling()],
    versioning: false, // to prevent importmap forcing fallback on js classic
  });
  // support + no bundling
  await test("2", {
    runtimeCompat: { chrome: "80" },
    versioning: false, // to prevent importmap forcing fallback on js classic
  });
  // no support for { type: "module" } on service worker
  await test("3", {
    runtimeCompat: { chrome: "79" },
    plugins: [jsenvPluginBundling()],
  });
  // no support for { type: "module" } on service worker + no bundling
  await test("4", {
    runtimeCompat: { chrome: "79" },
  });
}
