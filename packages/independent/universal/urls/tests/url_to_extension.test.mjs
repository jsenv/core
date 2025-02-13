import { assert } from "@jsenv/assert";

import { urlToExtension } from "@jsenv/urls";

{
  const actual = urlToExtension("http://example.com/dir/file.js?page=1");
  const expect = ".js";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("http://example.com/dir/file.");
  const expect = ".";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("http://example.com/dir/file");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("http://example.com/dir/");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("http://example.com/");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("file:///dir/file.js?page=1");
  const expect = ".js";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("file:///dir/?page=1");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("file:///?page=1");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("file://?page=1");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToExtension("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf");
  const expect = "";
  assert({ actual, expect });
}
