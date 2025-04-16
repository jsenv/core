import { startDevServer } from "@jsenv/core";
// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { jsenvPluginAsJsClassic } from "@jsenv/plugin-as-js-classic";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";

await startDevServer({
  logLevel: "info",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  clientAutoreload: false,
  supervisor: false,
  plugins: [jsenvPluginAsJsClassic(), jsenvPluginPreact()],
  port: 7878,
});
