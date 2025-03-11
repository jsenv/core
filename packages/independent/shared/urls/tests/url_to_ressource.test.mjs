import { assert } from "@jsenv/assert";

import { urlToResource } from "@jsenv/urls";

{
  const actual = urlToResource("http://example.com/dir/file.js?page=1");
  const expect = "/dir/file.js?page=1";
  assert({ actual, expect });
}

{
  const actual = urlToResource("http://example.com/dir/?foo=bar#10");
  const expect = "/dir/?foo=bar#10";
  assert({ actual, expect });
}

{
  const actual = urlToResource("http://example.com/");
  const expect = "/";
  assert({ actual, expect });
}

{
  const actual = urlToResource("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf");
  const expect = "d3958f5c-0777-0845-9dcf-2cb28783acaf";
  assert({ actual, expect });
}

{
  const actual = urlToResource("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf");
  const expect = "d3958f5c-0777-0845-9dcf-2cb28783acaf";
  assert({ actual, expect });
}

{
  const actual = urlToResource("file://C:\\dir\\file");
  const expect = "C:\\dir\\file";
  assert({ actual, expect });
}
