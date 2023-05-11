import { assert } from "@jsenv/assert";

import { setHtmlNodeAttributes, getHtmlNodeAttribute } from "@jsenv/ast";

{
  const htmlNode = {
    attrs: [
      {
        name: "foo",
        value: "1",
      },
    ],
  };
  setHtmlNodeAttributes(htmlNode, {
    foo: undefined,
  });
  const actual = getHtmlNodeAttribute(htmlNode, "foo");
  const expected = undefined;
  assert({ actual, expected });
}
