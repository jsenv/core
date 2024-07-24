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
    expect: ["a:start", "original:from_a", "original:start"],
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
      callsWithAB: ["a:first", "b:first", "original:first"],
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
    expect: [
      "a:start",
      "original:from_a",
      "b:start",
      "original:from_b",
      "original:start",
    ],
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
test("callOriginal complex", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  const spy = spyMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
    object.method("from_a");
    spy.callOriginal();
  });
  object.method("start");
  assert({
    actual: calls,
    expect: ["a:start", "original:from_a", "original:start"],
  });
});
test("when method called on other spy", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
      return `original:${value}`;
    },
  };
  const spyA = spyMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
    calls.push(`a.callOriginal()>${spyA.callOriginal()}`);
  });
  const spyB = spyMethod(object, "method", (value) => {
    calls.push(`b:${value}`);
    calls.push(`b.callOriginal()>${spyB.callOriginal()}`);
  });
  // let's assume this is a function body:
  object.method("startA");
  // and an other one:
  object.method("startB");
  // now let's assume the execution of B triggers an original call to the object
  spyB.remove();
  object.method("endB");
  assert({
    actual: calls,
    expect: [
      "a:startA",
      "original:startA",
      "a.callOriginal()>original:startA",
      "b:startA",
      "b.callOriginal()>original:startA",
      "a:startB",
      "original:startB",
      "a.callOriginal()>original:startB",
      "b:startB",
      "b.callOriginal()>original:startB",
      "a:endB",
      "original:endB",
      "a.callOriginal()>original:endB",
    ],
  });
});
