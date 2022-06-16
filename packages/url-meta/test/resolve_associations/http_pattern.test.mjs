import { assert } from "@jsenv/assert"

import { URL_META } from "@jsenv/url-meta"

const associations = URL_META.resolveAssociations(
  {
    whatever: {
      "file://": false,
      "http://": true,
    },
  },
  "file:///User/name/directory/",
)
const fileUrlMeta = URL_META.applyAssociations({
  url: "file:///dir/file.js",
  associations,
})
const httpUrlMeta = URL_META.applyAssociations({
  url: "http://example.com",
  associations,
})

const actual = {
  fileUrlMeta,
  httpUrlMeta,
}
const expected = {
  fileUrlMeta: {
    whatever: false,
  },
  httpUrlMeta: {
    whatever: true,
  },
}
assert({ actual, expected })
