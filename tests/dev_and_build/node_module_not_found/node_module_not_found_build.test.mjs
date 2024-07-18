import { fileURLToPath } from "node:url";
import { build } from "@jsenv/core";
import { writeFileSync } from "@jsenv/filesystem";
import { takeFileSnapshot } from "@jsenv/snapshot";

const sourceDirectoryUrl = new URL("./client/", import.meta.url);
try {
  await build({
    logLevel: "off",
    sourceDirectoryUrl,
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
  });
  throw new Error("should throw");
} catch (e) {
  const fileSnapshot = takeFileSnapshot(
    new URL("./output/error.txt", import.meta.url),
  );
  const sourceDirectoryPath = fileURLToPath(sourceDirectoryUrl);

  let message = e.message;
  message = message.replaceAll(sourceDirectoryPath, "/mock/");
  writeFileSync(new URL("./output/error.txt", import.meta.url), message);
  fileSnapshot.compare();
}
