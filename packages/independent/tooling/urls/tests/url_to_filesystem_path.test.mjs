import { assert } from "@jsenv/assert";
import { urlToFileSystemPath } from "@jsenv/urls";

const isWindows = process.platform === "win32";

if (isWindows) {
  {
    const actual = urlToFileSystemPath("file:///C:/directory/file.js");
    const expect = "C:\\directory\\file.js";
    assert({ actual, expect });
  }

  try {
    urlToFileSystemPath("file:///directory/file.js");
    throw new Error("should throw");
  } catch ({ code, message }) {
    const actual = { code, message };
    const expect = {
      code: "ERR_INVALID_FILE_URL_PATH",
      message: "File URL path must be absolute",
    };
    assert({ actual, expect });
  }
} else {
  {
    const actual = urlToFileSystemPath("file:///directory/file.js");
    const expect = "/directory/file.js";
    assert({ actual, expect });
  }
  {
    const actual = urlToFileSystemPath("file:///directory/#.js");
    const expect = "/directory/#.js";
    assert({ actual, expect });
  }
  {
    const actual = urlToFileSystemPath("file:///directory/%.js");
    const expect = "/directory/%.js";
    assert({ actual, expect });
  }
  {
    const actual = urlToFileSystemPath("file:///directory/a#b%c.js");
    const expect = "/directory/a#b%c.js";
    assert({ actual, expect });
  }
}

try {
  urlToFileSystemPath("http://example.com/directory/file.js");
  throw new Error("should throw");
} catch (error) {
  const actual = { code: error.code, name: error.name, message: error.message };
  const expect = {
    code: "ERR_INVALID_URL_SCHEME",
    name: "TypeError",
    message: "The URL must be of scheme file",
  };
  assert({ actual, expect });
}
