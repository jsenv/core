import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync } from "@jsenv/filesystem";

// "1_many_files"
let fixture = "2_index_exists";

const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
replaceFileStructureSync({
  from: new URL(`./fixtures/${fixture}/`, import.meta.url),
  to: sourceDirectoryUrl,
});
await startDevServer({
  serverLogLevel: "info",
  sourceDirectoryUrl,
  port: 4567,
});
