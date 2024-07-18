import { fileURLToPath } from "node:url";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { writeFileSync } from "@jsenv/filesystem";

import { build } from "@jsenv/core";

const sourceDirectoryUrl = new URL("./client/", import.meta.url);
const sourceDirectoryPath = fileURLToPath(sourceDirectoryUrl);
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
  const errorFileUrl = new URL("./output/error.txt", import.meta.url);
  const errorFileSnapshot = takeFileSnapshot(errorFileUrl);
  let message = e.message;
  message = message.replaceAll(sourceDirectoryPath, "/mock/");
  writeFileSync(errorFileUrl, message);
  errorFileSnapshot.compare();
}
