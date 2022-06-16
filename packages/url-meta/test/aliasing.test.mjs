import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/url-meta"

{
  const actual = URL_META.applyAliases({
    url: "file:///alias.json",
    aliases: {
      "file:///alias.json": "file:///data.json",
    },
  })
  const expected = "file:///data.json"
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAliases({
    url: "file:///a.js",
    aliases: {
      "file:///*.js": "file:///file.js",
    },
  })
  const expected = "file:///file.js"
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAliases({
    url: "file:///dir/b.txt",
    aliases: {
      "file:///dir/*": "file:///dir/a.txt",
    },
  })
  const expected = "file:///dir/a.txt"
  assert({ actual, expected })
}

{
  const actual = URL_META.applyAliases({
    url: "file:///foo/deep/4fhj.js",
    aliases: {
      "file:///*/deep/*.js": "file:///*/deep/file.js",
    },
  })
  const expected = "file:///foo/deep/file.js"
  assert({ actual, expected })
}
