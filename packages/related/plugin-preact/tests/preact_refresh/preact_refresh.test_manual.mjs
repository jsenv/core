import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

startDevServer({
  port: 5678,
  sourceDirectoryUrl: new URL("./git_ignored/", import.meta.url),
  plugins: [
    jsenvPluginExplorer({
      groups: {
        client: {
          "./*.html": true,
        },
      },
    }),
    jsenvPluginPreact({
      refreshInstrumentation: true,
    }),
  ],
  sourcemaps: "file",
  sourceFilesConfig: {
    "./**": true,
  },
});
