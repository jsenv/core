import { assert } from "@jsenv/assert";

import { getCommonPathname } from "@jsenv/urls/src/common_pathname.js";

{
  const actual = getCommonPathname("/ab/file.js", "/a/file.js");
  const expect = "/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/source/a.txt", "/source");
  const expect = "/source/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/var", "/var/lib");
  const expect = "/var";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/", "/a/file.js");
  const expect = "/a/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/file.js", "/a/");
  const expect = "/a/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/whatever.js", "/a/whatever.js");
  const expect = "/a/whatever.js";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/whatever.js", "/a/");
  const expect = "/a/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/whatever.js", "/a/base.js");
  const expect = "/a/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/whatever.js", "/b/base.js");
  const expect = "/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/b/whatever.js", "/a/b/base.js");
  const expect = "/a/b/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/b/c/d/whatever.js", "/a/b/base.js");
  const expect = "/a/b/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/a/", "/a/base.js");
  const expect = "/a/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/", "/");
  const expect = "/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/whatever.js", "/");
  const expect = "/";
  assert({ actual, expect });
}

{
  const actual = getCommonPathname("/", "/base.js");
  const expect = "/";
  assert({ actual, expect });
}
