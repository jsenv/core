import * as resolver from "@jsenv/eslint-import-resolver";
import { snapshotTests } from "@jsenv/snapshot";
import { urlToFileSystemPath } from "@jsenv/urls";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_leading_slash", () => {
    return resolver.resolve(
      "/foo/answer.js",
      urlToFileSystemPath(import.meta.resolve("./client/index.js")),
      {
        logLevel: "warn",
      },
    );
  });
});
