// TODO: a lot of tests
// especially a few on callbacks ensuring hook
// is considered as executing even inside callback

import { assert } from "@jsenv/assert";
import {
  hookIntoMethod,
  METHOD_EXECUTION_NODE_CALLBACK,
} from "@jsenv/snapshot/src/side_effects/hook_into_method.js";

const test = (scenario, fn) => {
  fn();
};

test("original call", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  hookIntoMethod(object, "method", (value) => {
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
  hookIntoMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
    return {
      preventOriginalCall: true,
    };
  });
  object.method("start");
  assert({
    actual: calls,
    expect: ["a:start"],
  });
});
test("calling original inside spy", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  hookIntoMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
    object.method("from_a");
  });
  object.method("start");
  assert({
    actual: calls,
    expect: ["a:start", "original:from_a", "original:start"],
  });
});
test(`a and b removed`, () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  const aHook = hookIntoMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
  });
  const bHook = hookIntoMethod(object, "method", (value) => {
    calls.push(`b:${value}`);
  });
  object.method("first");
  const callsWithAB = calls.slice();
  calls.length = 0;
  aHook.remove();
  object.method("second");
  const callsWithB = calls.slice();
  calls.length = 0;
  bHook.remove();
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
test("when hook is executing other hook do not know and call go through", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
    },
  };
  hookIntoMethod(object, "method", (value) => {
    calls.push(`a:${value}`);
    object.method("from_a");
  });
  hookIntoMethod(object, "method", (value) => {
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
test("return", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
      return 42;
    },
  };
  hookIntoMethod(object, "method", (value) => {
    calls.push(`a.init:${value}`);
    return {
      return: (value) => {
        calls.push(`a.return:${value}`);
        object.method("from_a_return");
      },
    };
  });
  hookIntoMethod(object, "method", (value) => {
    calls.push(`b.init:${value}`);
  });
  object.method("start");
  assert({
    actual: calls,
    expect: [
      "a.init:start",
      "b.init:start",
      "original:start",
      "a.return:42",
      "original:from_a_return",
    ],
  });
});
test("node callback style error", async () => {
  const calls = [];
  const object = {
    method: (value, callback) => {
      calls.push(`original:${value}`);
      setTimeout(() => {
        callback("here");
      }, 10);
    },
  };
  hookIntoMethod(
    object,
    "method",
    (value) => {
      calls.push(`a.init:${value}`);
      return {
        catch: (e) => {
          calls.push(`a.catch:${e}`);
        },
      };
    },
    { execute: METHOD_EXECUTION_NODE_CALLBACK },
  );
  await new Promise((resolve) => {
    object.method("start", (error) => {
      calls.push(`callback:${error}`);
      resolve();
    });
  });
  assert({
    actual: calls,
    expect: ["a.init:start", "original:start", "a.catch:here", "callback:here"],
  });
});
test("node callback style success", async () => {
  const calls = [];
  const object = {
    method: (value, callback) => {
      calls.push(`original:${value}`);
      setTimeout(() => {
        callback(null, "ok");
      }, 10);
    },
  };
  hookIntoMethod(
    object,
    "method",
    (value) => {
      calls.push(`a.init:${value}`);
      return {
        return: (value) => {
          calls.push(`a.return:${value}`);
        },
      };
    },
    { execute: METHOD_EXECUTION_NODE_CALLBACK },
  );
  await new Promise((resolve) => {
    object.method("start", (error, value) => {
      calls.push(`callback:${error},${value}`);
      resolve();
    });
  });
  assert({
    actual: calls,
    expect: [
      "a.init:start",
      "original:start",
      "a.return:ok",
      "callback:null,ok",
    ],
  });
});
test("node callback style sync", () => {
  const calls = [];
  const object = {
    method: (value) => {
      calls.push(`original:${value}`);
      return "ok";
    },
  };
  hookIntoMethod(
    object,
    "method",
    (value) => {
      calls.push(`a.init:${value}`);
      return {
        return: (value) => {
          calls.push(`a.return:${value}`);
        },
      };
    },
    { execute: METHOD_EXECUTION_NODE_CALLBACK },
  );

  object.method("start");

  assert({
    actual: calls,
    expect: ["a.init:start", "original:start", "a.return:ok"],
  });
});
