import { assert } from "@jsenv/assert";

import { urlToFilename } from "@jsenv/urls";

{
  const actual = urlToFilename("http://example.com/dir/file.js?page=1");
  const expected = "file.js";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("http://example.com/dir/file.?page=1");
  const expected = "file.";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("http://example.com/dir/file?page=1");
  const expected = "file";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("http://example.com/dir/");
  const expected = "dir";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("http://example.com/");
  const expected = "";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("file:///dir/file.js?page=1");
  const expected = "file.js";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("file:///dir/?page=1");
  const expected = "dir";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("file:///?page=1");
  const expected = "";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("file://?page=1");
  const expected = "";
  assert({ actual, expected });
}

{
  const actual = urlToFilename("blob:d3958f5c-0777-0845-9dcf-2cb28783acaf");
  const expected = "d3958f5c-0777-0845-9dcf-2cb28783acaf";
  assert({ actual, expected });
}
