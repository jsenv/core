import { assert } from "@jsenv/assert"

import { urlToRessource } from "@jsenv/urls"

{
  const actual = urlToRessource("http://example.com/dir/file.js?page=1")
  const expected = "/dir/file.js?page=1"
  assert({ actual, expected })
}

{
  const actual = urlToRessource("http://example.com/dir/?foo=bar#10")
  const expected = "/dir/?foo=bar#10"
  assert({ actual, expected })
}

{
  const actual = urlToRessource("http://example.com/")
  const expected = "/"
  assert({ actual, expected })
}

{
  const actual = urlToRessource("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf")
  const expected = "d3958f5c-0777-0845-9dcf-2cb28783acaf"
  assert({ actual, expected })
}

{
  const actual = urlToRessource("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf")
  const expected = "d3958f5c-0777-0845-9dcf-2cb28783acaf"
  assert({ actual, expected })
}

{
  const actual = urlToRessource("file://C:\\dir\\file")
  const expected = "C:\\dir\\file"
  assert({ actual, expected })
}
