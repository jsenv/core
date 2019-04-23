import { assert } from "@dmail/assert"
import { responseCompose } from "../responseCompose.js"

{
  const response = responseCompose(
    {
      headers: { foo: true },
    },
    {
      headers: { foo: false },
    },
  )
  assert({
    actual: response,
    expected: {
      status: undefined,
      statusText: undefined,
      headers: {
        foo: false,
      },
      body: undefined,
    },
  })
}

{
  const response = responseCompose(
    {
      headers: {
        "access-control-allow-headers": "a, b",
      },
    },
    {
      headers: {
        "access-control-allow-headers": "c, a",
        "content-type": "application/javascript",
      },
    },
  )
  assert({
    actual: response,
    expected: {
      status: undefined,
      statusText: undefined,
      headers: {
        "access-control-allow-headers": "a, b, c",
        "content-type": "application/javascript",
      },
      body: undefined,
    },
  })
}
