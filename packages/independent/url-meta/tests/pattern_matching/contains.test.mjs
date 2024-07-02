import { assert } from "@jsenv/assert";

import { URL_META } from "@jsenv/url-meta";

const test = ({ pattern, url }) => {
  return URL_META.applyPatternMatching({
    pattern: new URL(pattern, "file:///").href,
    url: new URL(url, "file:///").href,
  }).matched;
};

{
  const actual = test({
    pattern: "./dist/cdn/*flag.*.js",
    url: "./dist/cdn/flag.hash.js",
  });
  const expect = false;
  assert({ actual, expect });
}

{
  const actual = test({
    pattern: "./dist/cdn/*flag.*.js",
    url: "./dist/cdn/flag_startscreen.hash.js",
  });
  const expect = false;
  assert({ actual, expect });
}

{
  const actual = test({
    pattern: "file:///dist/cdn/**flag**.*.js",
    url: "./dist/cdn/flag.hash.js",
  });
  const expect = true;
  assert({ actual, expect });
}

{
  const actual = test({
    pattern: "file:///dist/cdn/**flag**.*.js",
    url: "./dist/cdn/flag_startscreen.hash.js",
  });
  const expect = true;
  assert({ actual, expect });
}
