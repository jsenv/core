import { startBuildServer } from "@jsenv/core";

await startBuildServer({
  buildDirectoryUrl: import.meta.resolve("./build/"),
  port: 0,
});
