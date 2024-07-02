import { assert } from "@jsenv/assert";

import { isFileSystemPath } from "@jsenv/urls";

{
  const actual = isFileSystemPath("file:///directory/file.js");
  const expect = false;
  assert({ actual, expect });
}

{
  const actual = isFileSystemPath("/directory/file.js");
  const expect = true;
  assert({ actual, expect });
}

{
  const actual = isFileSystemPath("c:/directory/file.js");
  const expect = true;
  assert({ actual, expect });
}

{
  const actual = isFileSystemPath("D:\\directory\\file.js");
  const expect = true;
  assert({ actual, expect });
}

{
  const actual = isFileSystemPath("foo");
  const expect = false;
  assert({ actual, expect });
}
