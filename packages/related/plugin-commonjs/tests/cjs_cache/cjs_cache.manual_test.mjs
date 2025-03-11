import { startDevServer } from "@jsenv/core";
import { jsenvPluginCommonJs } from "@jsenv/plugin-commonjs";

await startDevServer({
  logLevel: "info",
  rootDirectoryUrl: new URL("./client/", import.meta.url),
  port: 5432,
  plugins: [
    jsenvPluginCommonJs({
      include: {
        "./file.cjs": true,
      },
    }),
  ],
  clientAutoreload: false,
  supervisor: false,
});
