import { fileURLToPath } from "node:url";
import { build } from "@jsenv/core";
import { writeFileSync } from "@jsenv/filesystem";
import { takeFileSnapshot } from "@jsenv/snapshot";

const consoleErrorCalls = [];
const { error } = console;
console.error = (message) => {
  consoleErrorCalls.push(message);
};

const sourceDirectoryUrl = new URL("./client/", import.meta.url);
const sourceDirectoryPath = fileURLToPath(sourceDirectoryUrl);
const test = async (params) => {
  await build({
    logLevel: "error",
    sourceDirectoryUrl,
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    entryPoints: {
      "./main.noeslint.html": "main.html",
    },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
};

try {
  await test({
    runtimeCompat: { chrome: "89" },
    bundling: false,
    minification: false,
  });
  const callMocked = consoleErrorCalls.map((consoleErrorMessage) => {
    consoleErrorMessage = consoleErrorMessage.replaceAll(
      sourceDirectoryPath,
      "/mock/",
    );
    return consoleErrorMessage;
  });
  const consoleOutputFileSnapshot = takeFileSnapshot(
    new URL("./output/console_errors.txt", import.meta.url),
  );
  writeFileSync(
    new URL("./output/console_errors.txt", import.meta.url),
    callMocked[0],
  );
  consoleOutputFileSnapshot.compare();
} finally {
  console.error = error;
}
