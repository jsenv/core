import { assert } from "@jsenv/assert";

import { getHtmlNodeAttribute, setHtmlNodeAttributes } from "@jsenv/ast";

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
  const expect = undefined;
  assert({ actual, expect });
}
