import { createMagicSource } from "./magic_source.js"

const magicSource = createMagicSource({
  url: "file:///file.js",
  content: "console.log(42)",
  map: null,
})
magicSource.prepend("foo")
magicSource.append("bar")
const { code } = magicSource.toStringAndMap()
console.log(code)
