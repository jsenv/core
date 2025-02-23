import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

const associations = URL_META.resolveAssociations(
  { whatever: { "**/*": true } },
  "file:///a b/",
);
const meta = URL_META.applyAssociations({
  url: "file:///a%20b/file.js",
  associations,
});
const actual = meta;
const expect = { whatever: true };
assert({ actual, expect });
