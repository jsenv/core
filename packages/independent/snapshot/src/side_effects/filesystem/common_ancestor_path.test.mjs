import { assert } from "@jsenv/assert";
import { findCommonAncestorPath } from "./common_ancestor_path.js";

const test = (paths, expect) => {
  const actual = findCommonAncestorPath(paths);
  assert({ actual, expect });
};

test(["/a/b/c/d", "/a/b/c/d/"], "/a/b/c/d");
test(["/a/b/c", "/a/b/d", "/a/x/y"], "/a/");
test(["/a/b/", "/a/b/"], "/a/b/");
test(["/a", "/a/b/c"], "/a");
test(["/a/b/c", "/a"], "/a/");
test(["/a/b/c"], "/a/b/c");
