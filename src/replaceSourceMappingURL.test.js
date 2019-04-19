import assert from "assert"
import { updateSourceMappingURL } from "./source-mapping-url.js"

{
  const source = `${"//#"} sourceMappingURL=a.js`
  const actual = updateSourceMappingURL(source, (value) => `${value}.map`)
  const expected = `${"//#"} sourceMappingURL=a.js.map`
  assert.equal(actual, expected)
}

{
  const source = `before
${"//#"} sourceMappingURL=a.js
after`
  const actual = updateSourceMappingURL(source, (value) => `${value}.map`)
  const expected = `before
${"//#"} sourceMappingURL=a.js.map
after`
  assert.equal(actual, expected)
}

console.log("passed")
