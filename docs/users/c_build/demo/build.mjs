import { build } from "@jsenv/core";
import { captureLogsIntoFile } from "@jsenv/snapshot";

await captureLogsIntoFile(
  async () => {
    await build({
      logs: {
        animated: false,
      },
      sourceDirectoryUrl: import.meta.resolve("./src/"),
      buildDirectoryUrl: import.meta.resolve("./dist/"),
      entryPoints: {
        "./index.html": {
          bundling: false,
          minification: false,
        },
      },
    });
  },
  {
    svgFileUrl: import.meta.resolve("../build_terminal.svg"),
  },
);
