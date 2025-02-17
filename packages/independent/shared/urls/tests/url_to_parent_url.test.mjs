import { assert } from "@jsenv/assert";

import { urlToParentUrl } from "@jsenv/urls";

{
  const actual = urlToParentUrl("http://example.com/dir/file.js?page=1");
  const expect = "http://example.com/dir/";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("http://example.com/dir/");
  const expect = "http://example.com/";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("http://example.com/");
  const expect = "http://example.com/";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("http://example.com");
  const expect = "http://example.com";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("http://example.com?page=1");
  const expect = "http://example.com?page=1";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("file:///dir/file.js?page=1");
  const expect = "file:///dir/";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("file:///dir/");
  const expect = "file:///";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("file:///");
  const expect = "file:///";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("file://");
  const expect = "file://";
  assert({ actual, expect });
}

{
  const actual = urlToParentUrl("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf");
  const expect = "blob:d3958f5c-0777-0845-9dcf-2cb28783acaf";
  assert({ actual, expect });
}
