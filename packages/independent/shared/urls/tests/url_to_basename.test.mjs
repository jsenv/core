import { assert } from "@jsenv/assert";

import { urlToBasename } from "@jsenv/urls";

{
  const actual = urlToBasename("http://example.com/dir/file.js?page=1");
  const expect = "file";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("http://example.com/dir/file.");
  const expect = "file";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("http://example.com/dir/file");
  const expect = "file";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("http://example.com/dir/");
  const expect = "dir";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("http://example.com/");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("file:///dir/file.js?page=1");
  const expect = "file";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("file:///dir/?page=1");
  const expect = "dir";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("file:///?page=1");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("file://?page=1");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToBasename("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf");
  const expect = "d3958f5c-0777-0845-9dcf-2cb28783acaf";
  assert({ actual, expect });
}
