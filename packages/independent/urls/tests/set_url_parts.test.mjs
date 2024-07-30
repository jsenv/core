import { assert } from "@jsenv/assert";
import { setUrlBasename, setUrlFilename } from "@jsenv/urls";

{
  const actual = setUrlFilename("file:///dir/a.js?foo=bar#test", "b.js");
  const expect = "file:///dir/b.js?foo=bar#test";
  assert({ actual, expect });
}

{
  const urlObject = new URL("http://example.com/dir/file.js?a=a&b=b#hash");
  setUrlBasename(urlObject, "youhou");
  const actual = urlObject.href;
  const expect = "http://example.com/dir/youhou.js?a=a&b=b#hash";
  assert({ actual, expect });
}
