import { assert } from "@jsenv/assert";

import { urlToFileSystemPath } from "@jsenv/urls";

const isWindows = process.platform === "win32";

if (isWindows) {
  {
    const actual = urlToFileSystemPath("file:///C:/directory/file.js");
    const expected = "C:\\directory\\file.js";
    assert({ actual, expected });
  }

  try {
    urlToFileSystemPath("file:///directory/file.js");
    throw new Error("should throw");
  } catch ({ code, message }) {
    const actual = { code, message };
    const expected = {
      code: "ERR_INVALID_FILE_URL_PATH",
      message: "File URL path must be absolute",
    };
    assert({ actual, expected });
  }
} else {
  const actual = urlToFileSystemPath("file:///directory/file.js");
  const expected = "/directory/file.js";
  assert({ actual, expected });
}

try {
  urlToFileSystemPath("http://example.com/directory/file.js");
  throw new Error("should throw");
} catch (error) {
  const actual = { code: error.code, name: error.name, message: error.message };
  const expected = {
    code: "ERR_INVALID_URL_SCHEME",
    name: "TypeError",
    message: "The URL must be of scheme file",
  };
  assert({ actual, expected });
}
