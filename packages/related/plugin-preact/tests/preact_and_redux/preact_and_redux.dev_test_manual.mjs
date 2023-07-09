import { startDevServer } from "@jsenv/core";

import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

const plugins = [
  jsenvPluginPreact(),
  jsenvPluginCommonJs({
    include: {
      "/**/node_modules/react-is/": true,
      "/**/node_modules/use-sync-external-store/": {
        external: ["react"],
      },
      "/**/node_modules/hoist-non-react-statics/": {
        external: ["react-is"],
      },
    },
  }),
];

startDevServer({
  port: 5678,
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  plugins,
  sourcemaps: "file",
  clientFiles: {
    "./": true,
    "./.jsenv/": false,
  },
  clientMainFileUrl: new URL("./client/main.html", import.meta.url),
});
