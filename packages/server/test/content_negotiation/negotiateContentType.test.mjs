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
        accept: "text/plain, application/javascript",
      },
    },
    ["application/javascript"],
  )
  const expected = "application/javascript"
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/plain, application/javascript",
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
    ["application/javascript"],
  )
  const expected = "application/javascript"
  assert({ actual, expected })
}

{
  const actual = negotiateContentType(
    {
      headers: {
        accept: "text/plain, */*;q=0.1",
      },
    },
    ["application/javascript"],
  )
  const expected = "application/javascript"
  assert({ actual, expected })
}
