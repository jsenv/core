import { assert } from "@jsenv/assert";

import { isFileSystemPath } from "@jsenv/urls";

{
  const actual = isFileSystemPath("file:///directory/file.js");
  const expected = false;
  assert({ actual, expected });
}

{
  const actual = isFileSystemPath("/directory/file.js");
  const expected = true;
  assert({ actual, expected });
}

{
  const actual = isFileSystemPath("c:/directory/file.js");
  const expected = true;
  assert({ actual, expected });
}

{
  const actual = isFileSystemPath("D:\\directory\\file.js");
  const expected = true;
  assert({ actual, expected });
}

{
  const actual = isFileSystemPath("foo");
  const expected = false;
  assert({ actual, expected });
}
