import { jsenvPluginPreact } from "@jsenv/plugin-preact"
import { startDevServer } from "@jsenv/core"

await startDevServer({
  port: 3589,
  protocol: "https",
  listenAnyIp: true,
  rootDirectoryUrl: new URL("./", import.meta.url),
  plugins: [jsenvPluginPreact()],
  explorerGroups: {
    main: {
      "./client/main.html": true,
    },
  },
  autorestart: {
    url: import.meta.url,
  },
})
