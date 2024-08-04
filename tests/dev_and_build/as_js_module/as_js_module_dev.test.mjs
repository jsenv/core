import { assert } from "@jsenv/assert";
import { startDevServer } from "@jsenv/core";
import { executeHtml } from "@jsenv/core/tests/execute_html.js";
import { chromium, firefox } from "playwright";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const actual = {
  chromium: await executeHtml(`${devServer.origin}/main.html`, {
    browserLauncher: chromium,
  }),
  firefox: await executeHtml(`${devServer.origin}/main.html`, {
    browserLauncher: firefox,
  }),
};
const expect = {
  chromium: 42,
  firefox: 42,
};
assert({ actual, expect });
