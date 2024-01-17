import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

const CustomConstructor = function () {
  this.foo = true;
};
const customInstance = new CustomConstructor();
const actual = humanize(customInstance);
const expected = `CustomConstructor({
  "foo": true
})`;
assert({ actual, expected });
