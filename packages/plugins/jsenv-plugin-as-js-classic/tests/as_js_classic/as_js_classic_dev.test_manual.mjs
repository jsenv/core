import { startDevServer } from "@jsenv/core";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

startDevServer({
  logLevel: "info",
  plugins: [jsenvPluginAsJsClassic()],
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  sourceMainFilePath: "main.html",
  clientAutoreload: true,
  supervisor: false,
});
