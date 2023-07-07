import { startDevServer } from "@jsenv/core";
import { jsenvPluginExplorer } from "@jsenv/plugin-explorer";

export const devServer = await startDevServer({
  logLevel: process.env.GENERATING_SNAPSHOTS ? "off" : undefined,
  serverLogLevel: process.env.GENERATING_SNAPSHOTS ? "off" : undefined,
  port: 3589,
  sourceDirectoryUrl: new URL("./stories/", import.meta.url),
  supervisor: {
    // logs: true,
    errorBaseUrl: process.env.GENERATING_SNAPSHOTS ? "file:///" : undefined,
  },
  plugins: [
    {
      name: "plugin_throwing",
      appliesDuring: "*",
      resolveReference: (reference) => {
        if (
          reference.ownerUrlInfo.url.includes("plugin_error_resolve/main.js") &&
          reference.specifier === "./file.js"
        ) {
          throw new Error("error_during_resolve");
        }
      },
      fetchUrlContent: ({ url }) => {
        if (url.includes("plugin_error_load/main.js")) {
          throw new Error("error_during_load");
        }
      },
      transformUrlContent: ({ url }) => {
        if (url.includes("plugin_error_transform/main.js")) {
          throw new Error("error_during_transform");
        }
      },
    },
    jsenvPluginExplorer({
      groups: {
        stories: {
          "./**/*.html": true,
        },
      },
    }),
  ],
  outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
  // sourcemaps: "file",
  // sourcemapsSourcesProtocol: "source-maps://",
  ribbon: false,
  clientAutoreload: false,
});
