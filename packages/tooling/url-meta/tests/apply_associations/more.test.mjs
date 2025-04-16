import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

const test = ({ shouldBeIncluded, shouldBeExcluded }) => {
  const included = [];
  const excluded = [];
  const urls = [...shouldBeIncluded, ...shouldBeExcluded];
  for (const url of urls) {
    const meta = URL_META.applyAssociations({
      url,
      associations: URL_META.resolveAssociations(
        {
          testPlan: {
            "./**/*.test.js": {
              runtime: "node",
            },
            "./**/*.test.html": {
              runtime: "browser",
            },
            "**/.jsenv/": null,
            "**/.*/": null,
            "./packages/": null,
            "./**/node_modules/": null,
          },
        },
        "file:///project/",
      ),
    });
    if (meta.testPlan) {
      included.push(url);
    } else {
      excluded.push(url);
    }
  }

  assert({
    actual: {
      included,
      excluded,
    },
    expect: {
      included: shouldBeIncluded,
      excluded: shouldBeExcluded,
    },
  });
};

test({
  shouldBeExcluded: [
    "file:///project/.git/file.test.js",
    "file:///project/packages/file.test.js",
    "file:///project/packages/package-name/file.test.js",
    "file:///project/node_modules/file.test.js",
    "file:///project/.github/workflows/check_run_playground/src/a.test.mjs",
  ],
  shouldBeIncluded: [
    "file:///project/file.test.js",
    "file:///project/tests/file.test.js",
  ],
});
