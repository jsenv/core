/*
 * An html url can carry search params (a page storing its state in the url),
 * and its inline scripts inherit them in their own urls — including VALUELESS
 * params ("?enabled"), which URLSearchParams serializes as "?enabled=": two
 * spellings of the same url. Graph urls use the canonical spelling (the "="
 * is stripped, see normalizeUrl), and the url a request asks for must be
 * normalized the same way before being compared to them: an inline urlInfo
 * decides "is this request for me?" with that string comparison
 * (jsenv:inline_content_fetcher), and when it wrongly fails the inline
 * content is cooked a second time FROM ITS ALREADY COOKED CONTENT — every
 * injected prelude lands twice and the browser throws
 * "Identifier 'createImportMetaHot' has already been declared".
 *
 * The import.meta.hot prelude is the marker used below: cooked once, the
 * import of createImportMetaHot appears exactly once, whatever the params.
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
// node fetch would be served untransformed content, where nothing is injected
// and the double injection cannot be observed
const fetchAsChrome = async (resource) => {
  const response = await fetch(new URL(resource, devServer.origin), {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  });
  return response.text();
};

// fetch the html then its inline script, exactly like a browser: the inline
// script url is read from the served html, so it carries whatever search
// params the html url handed down to it
const fetchInlineScriptOfHtml = async (htmlResource) => {
  const html = await fetchAsChrome(htmlResource);
  const match = html.match(/src="(\/main\.html@[^"]+)"/);
  const inlineScriptResource = match[1].replace(/&amp;/g, "&");
  const js = await fetchAsChrome(inlineScriptResource);
  return { inlineScriptResource, js };
};

const countPreludeInjections = (js) =>
  js.split("import { createImportMetaHot }").length - 1;

try {
  // no search params
  {
    const { js } = await fetchInlineScriptOfHtml("/main.html");
    const actual = countPreludeInjections(js);
    const expect = 1;
    assert({ actual, expect });
  }

  // a valued param: same spelling on both sides, nothing to normalize
  {
    const { inlineScriptResource, js } = await fetchInlineScriptOfHtml(
      "/main.html?foo=1",
    );
    const actual = {
      inlineScriptResource,
      preludeInjectionCount: countPreludeInjections(js),
    };
    const expect = {
      inlineScriptResource: assert.startsWith("/main.html@"),
      preludeInjectionCount: 1,
    };
    assert({ actual, expect });
  }

  // a valueless param: the spelling URLSearchParams re-serializes ("?enabled=")
  // differs from the graph's ("?enabled") — the case that used to double-cook
  {
    const { js } = await fetchInlineScriptOfHtml("/main.html?enabled");
    const actual = countPreludeInjections(js);
    const expect = 1;
    assert({ actual, expect });
  }

  // valueless and valued params together, the real-world shape
  // (a page whose empty fields are valueless params next to filled ones)
  {
    const { js } = await fetchInlineScriptOfHtml(
      "/main.html?club=e3&search&player=e8",
    );
    const actual = countPreludeInjections(js);
    const expect = 1;
    assert({ actual, expect });
  }
} finally {
  await devServer.stop();
}
