import { assert } from "@jsenv/assert"

import { createMagicSource } from "./magic_source.js"

{
  const magicSource = createMagicSource({
    url: "file:///file.js",
    content: "console.log(42)",
    map: null,
  })
  magicSource.prepend("foo")
  magicSource.append("bar")
  const { content } = magicSource.toContentAndSourcemap()
  const actual = content
  const expected = `fooconsole.log(42)bar`
  assert({ actual, expected })
}

{
  const magicSource = createMagicSource({
    url: "file:///file.js",
    content: "ZZaaZZ",
    map: null,
  })
  magicSource.replace({
    start: 2,
    end: 3,
    replacement: "b",
  })
  magicSource.replace({
    start: 2,
    end: 2,
    replacement: "ccc",
  })
  const { content } = magicSource.toContentAndSourcemap()
  const actual = content
  const expected = `ZZcccZZ`
  assert({ actual, expected })
}
