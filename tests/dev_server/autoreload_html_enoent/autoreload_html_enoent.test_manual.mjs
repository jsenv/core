import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync } from "@jsenv/filesystem";

let fixture = "0_at_start";
// let fixture = "1_many_files";
// let fixture = "2_index_exists";

const sourceDirectoryUrl = new URL("./git_ignored/", import.meta.url);
replaceFileStructureSync({
  from: new URL(`./fixtures/${fixture}/`, import.meta.url),
  to: sourceDirectoryUrl,
});
await startDevServer({
  sourceDirectoryUrl,
  port: 4567,
  clientAutoreload: true,
  supervisor: false,
  ribbon: false,
});
