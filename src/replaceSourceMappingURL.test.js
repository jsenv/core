import assert from "assert"
import { sourceMappingURLMap } from "./replaceSourceMappingURL.js"

{
  const source = `${"//#"} sourceMappingURL=a.js`
  const actual = sourceMappingURLMap(source, (value) => `${value}.map`)
  const expected = `${"//#"} sourceMappingURL=a.js.map`
  assert.equal(actual, expected)
}

{
  const source = `before
${"//#"} sourceMappingURL=a.js
after`
  const actual = sourceMappingURLMap(source, (value) => `${value}.map`)
  const expected = `before
${"//#"} sourceMappingURL=a.js.map
after`
  assert.equal(actual, expected)
}

console.log("passed")
