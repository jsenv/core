import { assert } from "@jsenv/assert";
import { spyMethod } from "@jsenv/snapshot/src/function_side_effects/spy_method.js";

const test = (scenario, fn) => {
  fn();
};

test("original called by default", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  spyMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
  });
  object.method("start");
  assert({
    actual: calls,
    expect: ["a:start", "original:start"],
  });
});
test("original call can be prevented", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  const spy = spyMethod(object, "method", (value) => {
    spy.preventOriginalCall();
    calls.push(`a:${value}`);
  });
  object.method("start");
  assert({
    actual: calls,
    expect: ["a:start"],
  });
});
test("calling method inside spy", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  spyMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
    object.method("from_a");
  });
  object.method("start");
  assert({
    actual: calls,
    expect: ["a:start", "original:from_a"],
  });
});
test(`a and b uninstalled`, () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  const aSpy = spyMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
  });
  const bSpy = spyMethod(object, "method", (value) => {
    calls.push(`b:${value}`);
  });
  object.method("first");
  const callsWithAB = calls.slice();
  calls.length = 0;
  aSpy.remove();
  object.method("second");
  const callsWithB = calls.slice();
  calls.length = 0;
  bSpy.remove();
  object.method("third");
  const callsWithNothing = calls.slice();
  assert({
    actual: {
      callsWithAB,
      callsWithB,
      callsWithNothing,
    },
    expect: {
      callsWithAB: ["a:first", "original:first", "b:first", "original:first"],
      callsWithB: ["b:second", "original:second"],
      callsWithNothing: ["original:third"],
    },
  });
});
test("when spy is executing other spy do not know and call go through", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  spyMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
    object.method("from_a");
  });
  spyMethod(object, "method", (value) => {
    calls.push(`b:${value}`);
    object.method("from_b");
  });
  object.method("start");
  assert({
    actual: calls,
    expect: ["a:start", "original:from_a", "b:start", "original:from_b"],
  });
});
test("callOriginal can be used", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  const spy = spyMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
    spy.callOriginal();
  });
  object.method("start");
  assert({
    actual: calls,
    expect: ["a:start", "original:start"],
  });
});
