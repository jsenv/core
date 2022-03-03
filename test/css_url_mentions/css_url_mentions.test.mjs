import { readFileSync } from "node:fs"
import { assert } from "@jsenv/assert"

import { parseCssUrlMentions } from "#omega/plugins/url_mentions/css/css_url_mentions.js"

const { urlMentions } = await parseCssUrlMentions({
  url: new URL("./style.css", import.meta.url),
  content: await readFileSync(new URL("./style.css", import.meta.url)),
})
const actual = urlMentions
const expected = [
  {
    type: "css_url",
    specifier: "./img.png",
    start: 4,
    end: 15,
  },
]
assert({ actual, expected })
