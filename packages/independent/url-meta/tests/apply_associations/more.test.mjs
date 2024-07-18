import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

const test = ({ shouldBeIncluded, shouldBeExcluded }) => {
  const included = [];
  const excluded = [];
  const urls = [...shouldBeIncluded, ...shouldBeExcluded];
  for (const url of urls) {
    const meta = URL_META.applyAssociations({
      url,
      associations: {
        include: {
          "file:///**/*.test.js": {
            runtime: "node",
          },
          "file:///**/packages/": null,
          "file:///**/.*/": null,
          "file:///**/node_modules/": null,
        },
      },
    });
    if (meta.include) {
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
  ],
  shouldBeIncluded: [
    "file:///project/file.test.js",
    "file:///project/tests/file.test.js",
  ],
});
