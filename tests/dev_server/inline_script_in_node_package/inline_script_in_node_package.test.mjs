/*
 * An html served from inside node_modules — jsenv's own /.internal pages live
 * there once jsenv is installed — hands its inline scripts a url the browser
 * then requests on its own: "page.html@L7C5-L9C13.js".
 *
 * That url is versioned ("?v=1.0.0", so the browser can cache a node module
 * forever) while the html it comes from is not: nothing resolved the page
 * through node_modules, it was simply asked for by address. The dev server
 * finds the inline content by walking back to the parent html, and a parent
 * looked up as "page.html?v=1.0.0" is a parent no url graph holds — the
 * inline script answered 404 "no inline content at this position" and the
 * page ran nothing.
 */

import { assert } from "@jsenv/assert";

import { startDevServer } from "@jsenv/core";

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  keepProcessAlive: false,
  clientAutoreload: false,
  supervisor: true,
  ribbon: false,
  port: 0,
});

// the kitchen instruments per runtime, detected from the user-agent: plain
// node fetch would be served the file untouched, inline urls and all
const fetchAsChrome = (resource) =>
  fetch(new URL(resource, devServer.origin), {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  });

try {
  const htmlResponse = await fetchAsChrome("/node_modules/foo/page.html");
  const html = await htmlResponse.text();
  const inlineScriptResource = html
    .match(/src="([^"]+page\.html@[^"]+)"/)[1]
    .replace(/&amp;/g, "&");
  const inlineScriptResponse = await fetchAsChrome(inlineScriptResource);
  const actual = {
    inlineScriptResource,
    status: inlineScriptResponse.status,
    text: await inlineScriptResponse.text(),
  };
  const expect = {
    // versioned: the inline content of a node module is cacheable like the
    // rest of that package
    inlineScriptResource: assert.matches(/\?v=1\.0\.0$/),
    status: 200,
    text: assert.matches(/window\.answer = 42;/),
  };
  assert({ actual, expect });
} finally {
  await devServer.stop();
}
