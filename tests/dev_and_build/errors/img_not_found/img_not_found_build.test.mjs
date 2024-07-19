import { takeFileSnapshot } from "@jsenv/snapshot";

import { build } from "@jsenv/core";

try {
  await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
  });
  throw new Error("should throw");
} catch (e) {
  const errorFileSnapshot = takeFileSnapshot(
    new URL("./output/error.txt", import.meta.url),
  );
  errorFileSnapshot.update(e.message);
}
