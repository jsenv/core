import assert from "assert"
import { replaceSourceMappingURL } from "./replaceSourceMappingURL.js"

{
  const source = `${"//#"} sourceMappingURL=a.js`
  const actual = replaceSourceMappingURL(source, (value) => `${value}.map`)
  const expected = `${"//#"} sourceMappingURL=a.js.map`
  assert.equal(actual, expected)
}

{
  const source = `before
${"//#"} sourceMappingURL=a.js
after`
  const actual = replaceSourceMappingURL(source, (value) => `${value}.map`)
  const expected = `before
${"//#"} sourceMappingURL=a.js.map
after`
  assert.equal(actual, expected)
}

console.log("passed")
