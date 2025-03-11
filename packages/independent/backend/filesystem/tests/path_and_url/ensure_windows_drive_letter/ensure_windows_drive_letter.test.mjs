import { assert } from "@jsenv/assert";

import { ensureWindowsDriveLetter } from "@jsenv/filesystem";

if (process.platform === "win32") {
  // url http, basUrl file
  {
    const actual = ensureWindowsDriveLetter(
      "http://example.com/file.js",
      "file:///C:/file",
    );
    const expect = "http://example.com/file.js";
    assert({ actual, expect });
  }

  // url file, baseUrl file
  {
    const actual = ensureWindowsDriveLetter(
      "file:///file.js",
      "file:///C:/directory/file.js",
    );
    const expect = "file:///C:/file.js";
    assert({ actual, expect });
  }

  // url file, baseUrl http
  {
    const actual = ensureWindowsDriveLetter(
      "file:///file.js",
      "http://example.com",
    );
    const expect = `file:///${process.cwd()[0]}:/file.js`;
    assert({ actual, expect });
  }

  // url file with drive letter, baseUrl http
  {
    const actual = ensureWindowsDriveLetter(
      "file:///C:/file.js",
      "http://example.com",
    );
    const expect = "file:///C:/file.js";
    assert({ actual, expect });
  }
  // url missing
  try {
    ensureWindowsDriveLetter();
  } catch (actual) {
    const expect = new Error(`absolute url expect but got undefined`);
    assert({ actual, expect });
  }

  // url relative
  try {
    ensureWindowsDriveLetter("./file.js");
  } catch (actual) {
    const expect = new Error(`absolute url expect but got ./file.js`);
    assert({ actual, expect });
  }

  // url file, baseUrl undefined
  try {
    ensureWindowsDriveLetter("file:///file.js");
  } catch (actual) {
    const expect = new Error(
      `absolute baseUrl expect but got undefined to ensure windows drive letter on file:///file.js`,
    );
    assert({ actual, expect });
  }

  // url file, baseUrl relative
  try {
    ensureWindowsDriveLetter("file:///file.js", "./file.js");
  } catch (actual) {
    const expect = new Error(
      `absolute baseUrl expect but got ./file.js to ensure windows drive letter on file:///file.js`,
    );
    assert({ actual, expect });
  }

  // url file, baseUrl file without drive letter
  try {
    ensureWindowsDriveLetter("file:///file.js", "file:///dir");
  } catch (actual) {
    const expect = new Error(
      `drive letter expect on baseUrl but got file:///dir to ensure windows drive letter on file:///file.js`,
    );
    assert({ actual, expect });
  }
} else {
  // the idea is to ensure the url is untouched because there no is drive letter concept outside windows

  // url file and baseUrl file
  const actual = ensureWindowsDriveLetter(
    "file:///file.js",
    "file:///C:/file.js",
  );
  const expect = "file:///file.js";
  assert({ actual, expect });
}
