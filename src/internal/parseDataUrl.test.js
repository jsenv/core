import { assert } from "@jsenv/assert"
import { parseDataUrl } from "./parseDataUrl.js"

{
  const actual = parseDataUrl("data:,")
  const expected = {
    mediaType: "text/plain;charset=US-ASCII",
    base64Flag: false,
    data: "",
  }
  assert({ actual, expected })
}

{
  const actual = parseDataUrl("data:,Hello%2C%20World!")
  const expected = {
    mediaType: "text/plain;charset=US-ASCII",
    base64Flag: false,
    data: "Hello%2C%20World!",
  }
  assert({ actual, expected })
}

{
  const actual = parseDataUrl("data:text/plain;base64,SGVsbG8sIFdvcmxkIQ%3D%3D")
  const expected = {
    mediaType: "text/plain",
    base64Flag: true,
    data: "SGVsbG8sIFdvcmxkIQ%3D%3D",
  }
  assert({ actual, expected })
}

{
  const actual = parseDataUrl("data:text/html,%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E")
  const expected = {
    mediaType: "text/html",
    base64Flag: false,
    data: "%3Ch1%3EHello%2C%20World!%3C%2Fh1%3E",
  }
  assert({ actual, expected })
}

{
  const actual = parseDataUrl("data:text/html,<script>alert('hi');</script>")
  const expected = {
    mediaType: "text/html",
    base64Flag: false,
    data: "<script>alert('hi');</script>",
  }
  assert({ actual, expected })
}
