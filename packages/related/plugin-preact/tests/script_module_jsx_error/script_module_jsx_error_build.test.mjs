import { build } from "@jsenv/core";
import { takeFileSnapshot, replaceFluctuatingValues } from "@jsenv/snapshot";

const consoleErrorCalls = [];
const { error } = console;
console.error = (message) => {
  consoleErrorCalls.push(message);
};
const test = async (params) => {
  await build({
    logLevel: "error",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
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
    return replaceFluctuatingValues(consoleErrorMessage, {
      rootDirectoryUrl: new URL("./", import.meta.url),
    });
  });
  const consoleOutputFileSnapshot = takeFileSnapshot(
    new URL("./output/console_errors.txt", import.meta.url),
  );
  consoleOutputFileSnapshot.update(callMocked[0]);
} finally {
  console.error = error;
}
