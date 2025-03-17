import { startDevServer } from "@jsenv/core";
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";

startDevServer({
  logLevel: "info",
  plugins: [jsenvPluginAsJsClassic()],
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  sourceMainFilePath: "main.html",
  clientAutoreload: false,
  supervisor: false,
  ribbon: false,
});
