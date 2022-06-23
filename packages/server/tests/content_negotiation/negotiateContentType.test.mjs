import { assert } from "@jsenv/assert"

import { negotiateContentType } from "@jsenv/server"

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/html",
      },
    },
    ["text/html"],
  )
  const expected = "text/html"
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/html",
      },
    },
    ["text/plain"],
  )
  const expected = null
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/*",
      },
    },
    ["text/plain"],
  )
  const expected = "text/plain"
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "image/*",
      },
    },
    ["text/plain"],
  )
  const expected = null
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "*/*",
      },
    },
    ["text/plain"],
  )
  const expected = "text/plain"
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/plain, text/javascript",
      },
    },
    ["text/javascript"],
  )
  const expected = "text/javascript"
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/plain, text/javascript",
      },
    },
    ["application/pdf"],
  )
  const expected = null
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/plain, */*",
      },
    },
    ["text/javascript"],
  )
  const expected = "text/javascript"
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/plain, */*;q=0.1",
      },
    },
    ["text/javascript"],
  )
  const expected = "text/javascript"
  assert({ actual, expected })
}
