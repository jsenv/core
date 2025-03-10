import { startBuildServer } from "@jsenv/core";

await startBuildServer({
  buildDirectoryUrl: new URL("./build/", import.meta.url),
  port: 0,
});
