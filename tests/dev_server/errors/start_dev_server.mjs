import { startDevServer } from "@jsenv/core"

export const devServer = await startDevServer({
  logLevel: process.env.GENERATING_SNAPSHOTS ? "off" : undefined,
  serverLogLevel: process.env.GENERATING_SNAPSHOTS ? "off" : undefined,
  port: 3589,
  sourceDirectoryUrl: new URL("./stories/", import.meta.url),
  supervisor: {
    errorBaseUrl: process.env.GENERATING_SNAPSHOTS ? "file:///" : undefined,
  },
  plugins: [
    {
      name: "plugin_throwing",
      appliesDuring: "*",
      resolveUrl: ({ parentUrl, specifier }) => {
        if (
          parentUrl.includes("plugin_error_resolve/main.js") &&
          specifier === "./file.js"
        ) {
          throw new Error("error_during_resolve")
        }
      },
      fetchUrlContent: ({ url }) => {
        if (url.includes("plugin_error_load/main.js")) {
          throw new Error("error_during_load")
        }
      },
      transformUrlContent: ({ url }) => {
        if (url.includes("plugin_error_transform/main.js")) {
          throw new Error("error_during_transform")
        }
      },
    },
  ],
  // sourcemaps: "file",
  // sourcemapsSourcesProtocol: "source-maps://",
  explorer: {
    groups: {
      stories: {
        "./**/*.html": true,
      },
    },
  },
})
