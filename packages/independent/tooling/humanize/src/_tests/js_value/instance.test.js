import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

const CustomConstructor = function () {
  this.foo = true;
};
const customInstance = new CustomConstructor();
const actual = humanize(customInstance);
const expect = `CustomConstructor({
  "foo": true
})`;
assert({ actual, expect });
