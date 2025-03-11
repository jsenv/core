import { assert } from "@jsenv/assert";

import { urlToFilename } from "@jsenv/urls";

{
  const actual = urlToFilename("http://example.com/dir/file.js?page=1");
  const expect = "file.js";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("http://example.com/dir/file.?page=1");
  const expect = "file.";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("http://example.com/dir/file?page=1");
  const expect = "file";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("http://example.com/dir/");
  const expect = "dir";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("http://example.com/");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("file:///dir/file.js?page=1");
  const expect = "file.js";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("file:///dir/?page=1");
  const expect = "dir";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("file:///?page=1");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("file://?page=1");
  const expect = "";
  assert({ actual, expect });
}

{
  const actual = urlToFilename("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf");
  const expect = "d3958f5c-0777-0845-9dcf-2cb28783acaf";
  assert({ actual, expect });
}
