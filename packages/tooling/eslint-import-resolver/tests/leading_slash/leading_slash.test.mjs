import * as resolver from "@jsenv/eslint-import-resolver";
import { snapshotTests } from "@jsenv/snapshot";
import { urlToFileSystemPath } from "@jsenv/urls";

await snapshotTests(import.meta.url, ({ test }) => {
  test("importing_without_src", () => {
    return resolver.resolve(
      "/answer.js",
      urlToFileSystemPath(import.meta.resolve("./client/src/index.js")),
      {
        logLevel: "warn",
      },
    );
  });

  test("importing_wit_src", () => {
    return resolver.resolve(
      "/src/answer.js",
      urlToFileSystemPath(import.meta.resolve("./client/src/index.js")),
      {
        logLevel: "warn",
      },
    );
  });

  test("recommended", () => {
    return resolver.resolve(
      "self/src/answer.js",
      urlToFileSystemPath(import.meta.resolve("./client/src/index.js")),
      {
        logLevel: "warn",
      },
    );
  });
});
