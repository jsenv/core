import * as resolver from "@jsenv/eslint-import-resolver";
import { snapshotTests } from "@jsenv/snapshot";
import { urlToFileSystemPath } from "@jsenv/urls";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_importing_without_src", () => {
    return resolver.resolve(
      "/answer.js",
      urlToFileSystemPath(import.meta.resolve("./client/src/index.js")),
      {
        logLevel: "warn",
      },
    );
  });

  test("1_importing_wit_src", () => {
    return resolver.resolve(
      "/src/answer.js",
      urlToFileSystemPath(import.meta.resolve("./client/src/index.js")),
      {
        logLevel: "warn",
      },
    );
  });

  test("2_recommended", () => {
    return resolver.resolve(
      "self/src/answer.js",
      urlToFileSystemPath(import.meta.resolve("./client/src/index.js")),
      {
        logLevel: "warn",
      },
    );
  });
});
