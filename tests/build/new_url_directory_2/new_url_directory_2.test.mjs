import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { takeDirectorySnapshot } from "@jsenv/core/tests/snapshots_directory.js";

const test = async (params) => {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.js": "main.js",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  takeDirectorySnapshot(
    new URL("./dist/", import.meta.url),
    new URL("./snapshots/", import.meta.url),
  );

  // eslint-disable-next-line import/no-unresolved
  const { directoryUrl } = await import("./dist/main.js");
  const actual = directoryUrl;
  const expected = new URL("./dist/src/", import.meta.url).href;
  assert({ actual, expected });
};

await test({
  directoryReferenceAllowed: true,
  runtimeCompat: { node: "19" },
});
