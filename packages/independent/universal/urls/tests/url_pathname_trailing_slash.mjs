import { assert } from "@jsenv/assert";

import {
  ensurePathnameTrailingSlash,
  removePathnameTrailingSlash,
} from "@jsenv/urls";

const testEnsure = (url, expect) => {
  const actual = ensurePathnameTrailingSlash(url);
  assert({ actual, expect });
};
testEnsure("file:///directory", "file:///directory/");
testEnsure("file:///directory/", "file:///directory/");
testEnsure("file:///directory/file.js", "file:///directory/file.js/");
testEnsure("file:///directory/file.js/", "file:///directory/file.js/");

const testRemove = (url, expect) => {
  const actual = removePathnameTrailingSlash(url);
  assert({ actual, expect });
};
testRemove("file:///directory", "file:///directory");
testRemove("file:///directory/", "file:///directory");
testRemove("file:///directory/file.js", "file:///directory/file.js");
testRemove("file:///directory/file.js/", "file:///directory/file.js");
