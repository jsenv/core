import { assert } from "@jsenv/assert"
import { getCommonPathname } from "./getCommonPathname.js"

{
  const actual = getCommonPathname("/a/whatever.js", "/a/whatever.js")
  const expected = "/a/whatever.js"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/a/whatever.js", "/a/")
  const expected = "/a/"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/a/whatever.js", "/a/base.js")
  const expected = "/a/"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/a/whatever.js", "/b/base.js")
  const expected = "/"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/a/b/whatever.js", "/a/b/base.js")
  const expected = "/a/b/"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/a/b/c/d/whatever.js", "/a/b/base.js")
  const expected = "/a/b/"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/a/", "/a/base.js")
  const expected = "/a/"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/", "/")
  const expected = "/"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/whatever.js", "/")
  const expected = "/"
  assert({ actual, expected })
}

{
  const actual = getCommonPathname("/", "/base.js")
  const expected = "/"
  assert({ actual, expected })
}
