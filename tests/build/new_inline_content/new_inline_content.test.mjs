import { assert } from "@jsenv/assert";

import { build } from "@jsenv/core";
import { startFileServer } from "@jsenv/core/tests/start_file_server.js";
import { executeInBrowser } from "@jsenv/core/tests/execute_in_browser.js";

const test = async (params) => {
  const { buildManifest } = await build({
    logLevel: "warn",
    sourceDirectoryUrl: new URL("./client/", import.meta.url),
    entryPoints: {
      "./main.html": "main.html",
    },
    buildDirectoryUrl: new URL("./dist/", import.meta.url),
    transpilation: { css: false },
    outDirectoryUrl: new URL("./.jsenv/", import.meta.url),
    ...params,
  });
  const server = await startFileServer({
    rootDirectoryUrl: new URL("./dist/", import.meta.url),
  });
  const { returnValue } = await executeInBrowser({
    url: `${server.origin}/main.html`,
    /* eslint-disable no-undef */
    pageFunction: async (jsRelativeUrl) => {
      const namespace = await import(jsRelativeUrl);
      // let 500ms for the background image to load
      await new Promise((resolve) => setTimeout(resolve, 500));
      const bodyBackgroundImage = getComputedStyle(
        document.body,
      ).backgroundImage;
      return {
        ...namespace,
        bodyBackgroundImage,
      };
    },
    /* eslint-enable no-undef */
    pageArguments: [`./${buildManifest["js/main.js"]}`],
  });
  const actual = returnValue;
  const expected = {
    complexInsideDoubleQuotes: `\n'😀'\n`,
    complexInsideSingleQuotes: `\n"😀"\n`,
    cssAndTemplate: `
body {
  background-image: url(/other/jsenv.png?v=25e95a00);
  background-image: url(/other/jsenv.png?v=25e95a00);
  background-image: url(/other/jsenv.png?v=25e95a00);
}
`,
    cssTextWithUrl: `\nbody { background-image: url(/other/jsenv.png?v=25e95a00); }\n`,
    cssTextWithUrl2: `\nbody { background-image: url(/other/jsenv.png?v=25e95a00); }\n`,
    doubleQuote: `"`,
    doubleQuoteEscaped: `"`,
    fromTemplate: `"`,
    fromTemplate2: `'`,
    fromTemplate3: `\n'"`,
    fromTemplate4: `
'"
`,
    lineEnding: `\n`,
    lineEnding2: `\n`,
    singleQuote: `'`,
    singleQuoteEscaped: `'`,
    whenInlined: `body { background-image: url(/other/jsenv.png?v=25e95a00); }`,
    whenRenamed: `body { background-image: url(/other/jsenv.png?v=25e95a00); }`,
    bodyBackgroundImage: `url("${server.origin}/other/jsenv.png?v=25e95a00")`,
  };
  assert({ actual, expected });
};

// script type module can be used
await test({ runtimeCompat: { chrome: "89" } });
