import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync } from "@jsenv/filesystem";

const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
replaceFileStructureSync({
  from: new URL("./fixtures/1_many_files/", import.meta.url),
  to: sourceDirectoryUrl,
});
await startDevServer({
  sourceDirectoryUrl,
  port: 4567,
});
