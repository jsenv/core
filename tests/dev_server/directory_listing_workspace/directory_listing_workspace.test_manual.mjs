import { startDevServer } from "@jsenv/core";
import { replaceFileStructureSync } from "@jsenv/filesystem";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

const projectDirectoryUrl = new URL("./git_ignored/", import.meta.url);
const sourceDirectoryUrl = new URL("./git_ignored/src/", import.meta.url);
replaceFileStructureSync({
  from: new URL("./fixtures/0_at_start/", import.meta.url),
  to: projectDirectoryUrl,
});
await startDevServer({
  sourceDirectoryUrl,
  port: 4567,
  plugins: [jsenvPluginPreact()],
});
