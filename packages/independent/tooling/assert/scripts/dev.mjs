import { startDevServer } from "@jsenv/core";

export const devServer = await startDevServer({
  sourceDirectoryUrl: new URL("../src/", import.meta.url),
  port: 3457,
  clientAutoreload: false,
});
