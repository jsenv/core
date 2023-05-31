import { startBuildServer } from "@jsenv/core";

await startBuildServer({
  rootDirectoryUrl: new URL("../src/", import.meta.url),
  buildDirectoryUrl: new URL("../dist/", import.meta.url),
  buildIndexPath: "main.html",
});
