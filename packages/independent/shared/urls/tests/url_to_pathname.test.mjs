import { assert } from "@jsenv/assert";

import { urlToPathname } from "@jsenv/urls";

{
  const actual = urlToPathname("http://example.com/dir/file.js?page=1");
  const expect = "/dir/file.js";
  assert({ actual, expect });
}

{
  const actual = urlToPathname("http://example.com/dir/");
  const expect = "/dir/";
  assert({ actual, expect });
}

{
  const actual = urlToPathname("http://example.com/");
  const expect = "/";
  assert({ actual, expect });
}

{
  const actual = urlToPathname("file:///dir/file.js?page=1");
  const expect = "/dir/file.js";
  assert({ actual, expect });
}

{
  const actual = urlToPathname("file:///dir/file.js?page=1#foo");
  const expect = "/dir/file.js";
  assert({ actual, expect });
}

{
  const actual = urlToPathname("file:///dir/file.js#foo");
  const expect = "/dir/file.js";
  assert({ actual, expect });
}

{
  const actual = urlToPathname("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf");
  const expect = "d3958f5c-0777-0845-9dcf-2cb28783acaf";
  assert({ actual, expect });
}
