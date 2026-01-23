import { assert } from "@jsenv/assert";
import { build } from "@jsenv/core";
import { executeBuildHtmlInBrowser } from "@jsenv/core/tests/execute_build_html_in_browser.js";
import { snapshotBuildTests } from "@jsenv/core/tests/snapshot_build_tests.js";
import { readFileSync } from "@jsenv/filesystem";

const { dirUrlMap } = await snapshotBuildTests(import.meta.url, ({ test }) => {
  test("0_js_module", () =>
    build({
      sourceDirectoryUrl: import.meta.resolve("./client/"),
      buildDirectoryUrl: import.meta.resolve("./build/"),
      entryPoints: {
        "./main.html": {
          bundling: false,
          minification: false,
          transpilation: { css: false },
          runtimeCompat: { chrome: "89" },
          assetManifest: true,
          packageSideEffects: false,
        },
      },
    }));
});

const buildManifest = readFileSync(
  `${dirUrlMap.get("0_js_module")}build/asset-manifest.json`,
);
const actual = await executeBuildHtmlInBrowser(
  `${dirUrlMap.get("0_js_module")}build/`,
  "main.html",
  {
    /* eslint-disable no-undef */
    pageFunction: async (jsRelativeUrl) => {
      const namespace = await import(jsRelativeUrl);
      // let 500ms for the background image to load
      await new Promise((resolve) => setTimeout(resolve, 500));
      bodyBackgroundImage = getComputedStyle(document.body).backgroundImage;
      bodyBackgroundImage = bodyBackgroundImage.replace(
        window.location.origin,
        "",
      );
      return {
        ...namespace,
        bodyBackgroundImage,
      };
    },
    /* eslint-enable no-undef */
    pageFunctionArg: `./${buildManifest["js/main.js"]}`,
  },
);
const jsenvPngVersioned = buildManifest["other/jsenv.png"];
const expect = {
  complexInsideDoubleQuotes: `\n'😀'\n`,
  complexInsideSingleQuotes: `\n"😀"\n`,
  cssAndTemplate: `
body {
  background-image: url(/${jsenvPngVersioned});
  background-image: url(/${jsenvPngVersioned});
  background-image: url(/${jsenvPngVersioned});
}
`,
  cssTextWithUrl: `\nbody { background-image: url(/${jsenvPngVersioned}); }\n`,
  cssTextWithUrl2: `\nbody { background-image: url(/${jsenvPngVersioned}); }\n`,
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
  bodyBackgroundImage: `url("/${jsenvPngVersioned}")`,
};
assert({ actual, expect });
