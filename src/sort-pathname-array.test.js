import { assert } from "@dmail/assert"
import { sortPathnameArray } from "./sort-pathname-array.js"

const pathnameArray = [
  "a/world",
  "a/lib/index.js",
  "b/package.json",
  "b/lib/3/index.js",
  "b/lib/2/README.js",
  "a/hello",
  "b/lib/2/index.js",
  "a/lib/README.md",
  "b/lib/3/README.js",
  "c",
]

const actual = sortPathnameArray(pathnameArray)
const expected = [
  "a/lib/index.js",
  "a/lib/README.md",
  "a/hello",
  "a/world",
  "b/lib/2/index.js",
  "b/lib/2/README.js",
  "b/lib/3/index.js",
  "b/lib/3/README.js",
  "b/package.json",
  "c",
]
assert({ actual, expected })
