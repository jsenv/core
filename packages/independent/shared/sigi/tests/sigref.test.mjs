import { assert } from "@jsenv/assert";
import { sigref } from "@jsenv/sigi";

// ref.value is updated by setter
{
  const [userRef, userSet] = sigref(null);
  const values = [];
  values.push(userRef.value);
  userSet("toto");
  values.push(userRef.value);
  const actual = values;
  const expect = [null, "toto"];
  assert({ actual, expect });
}

// ref.subscribe can be used to listen changes
{
  const [valueRef, valueSet] = sigref("a");
  const calls = [];
  valueRef.subscribe((value) => {
    calls.push(value);
  });
  const callsBeforeSet = calls.slice();
  valueSet("b");
  const callsAfterSet = calls.slice();
  const actual = {
    callsBeforeSet,
    callsAfterSet,
  };
  const expect = {
    callsBeforeSet: ["a"],
    callsAfterSet: ["a", "b"],
  };
  assert({ actual, expect });
}
