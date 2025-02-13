/* eslint-disable accessor-pairs */

import { tokenizeFunction } from "@jsenv/assert/src/utils/tokenize_function.js";

const test = (fn, expectedScan) => {
  const actual = tokenizeFunction(fn);
  for (const key of Object.keys(expectedScan)) {
    const expectedValue = expectedScan[key];
    const actualValue = actual[key];
    if (expectedValue !== actualValue) {
      throw new Error(`${actualValue} should be ${expectedValue} for "${key}"`);
    }
  }
};

async: {
  classic: {
    test(
      // prettier-ignore
      async   function   ()   {},
      {
        type: "classic",
        name: "",
        isAsync: true,
      },
    );
  }
  classic_generator: {
    test(
      // prettier-ignore
      async   function  *   ()   {},
      {
        type: "classic",
        name: "",
        isAsync: true,
        isGenerator: true,
      },
    );
  }
  arrow: {
    test(
      // prettier-ignore
      async   ()   =>   {},
      {
        type: "arrow",
        isAsync: true,
      },
    );
  }
  method_async: {
    test(
      {
        // prettier-ignore
        async   foo  () { return 10; },
      }.foo,
      {
        type: "method",
        methodName: "foo",
        argsAndBodySource: `() { return 10; }`,
        isAsync: true,
      },
    );
  }
  method_async_generator: {
    test(
      {
        // prettier-ignore
        async   *  foo  ()   {},
      }.foo,
      {
        type: "method",
        methodName: "foo",
        argsAndBodySource: `()   {}`,
        isAsync: true,
        isGenerator: true,
      },
    );
  }
  method_computed: {
    test(
      {
        // prettier-ignore
        async   ["foo"]  ()   {},
      }.foo,
      {
        type: "method",
        methodNameIsComputed: true,
        methodName: `"foo"`,
        argsAndBodySource: `()   {}`,
        isAsync: true,
      },
    );
  }
  method_computed_async_generator: {
    test(
      {
        // prettier-ignore
        async   *  ["foo"]  ()   {},
      }.foo,
      {
        type: "method",
        methodNameIsComputed: true,
        methodName: '"foo"',
        argsAndBodySource: `()   {}`,
        isAsync: true,
      },
    );
  }
}
generator: {
  classic_anonymous: {
    test(
      // prettier-ignore
      function  *   ()   {},
      {
        type: "classic",
        name: "",
        argsAndBodySource: `()   {}`,
        isGenerator: true,
      },
    );
  }
  classic_with_name: {
    test(
      // prettier-ignore
      function  *  foo  ()   {},
      {
        type: "classic",
        name: "foo",
        argsAndBodySource: `()   {}`,
        isGenerator: true,
      },
    );
  }
  method: {
    test(
      {
        // prettier-ignore
        *  foo  ()   {},
      }.foo,
      {
        type: "method",
        methodName: "foo",
        argsAndBodySource: `()   {}`,
        isGenerator: true,
      },
    );
  }
}
classes: {
  test(
    // prettier-ignore
    class   Animal   {  },
    {
      type: "class",
      argsAndBodySource: `{  }`,
    },
  );
  test(
    class a {
      toto = 10;
      static {
        this.toto++;
      }
      constructor() {
        console.log(this.toto);
      }
    },
    {
      type: "class",
    },
  );
}
basic: {
  arrow: {
    test(
      // prettier-ignore
      ()   =>   {},
      {
        type: "arrow",
        argsAndBodySource: `()   =>   {}`,
      },
    );
  }
  classic_anonymous: {
    test(
      // prettier-ignore
      function   ()   {},
      {
        type: "classic",
        name: "",
        argsAndBodySource: `()   {}`,
      },
    );
  }
  classic_with_name: {
    test(
      // prettier-ignore
      function   foo  ()   {},
      {
        type: "classic",
        name: "foo",
        argsAndBodySource: `()   {}`,
      },
    );
  }
  method: {
    test(
      {
        // prettier-ignore
        foo  ()   {},
      }.foo,
      {
        type: "method",
        methodName: "foo",
        argsAndBodySource: "()   {}",
      },
    );
  }
  method_computed: {
    test(
      {
        // prettier-ignore
        ["foo"]  ()   {},
      }.foo,
      {
        type: "method",
        methodNameIsComputed: true,
        methodName: `"foo"`,
        argsAndBodySource: `()   {}`,
      },
    );
  }
  getter: {
    test(
      Object.getOwnPropertyDescriptor(
        {
          // prettier-ignore
          get   foo  ()   { return 10; },
        },
        "foo",
      ).get,
      {
        type: "method",
        getterName: "foo",
        argsAndBodySource: `()   { return 10; }`,
      },
    );
  }
  setter: {
    test(
      Object.getOwnPropertyDescriptor(
        {
          // prettier-ignore
          set   foo  (v) {},
        },
        "foo",
      ).set,
      {
        type: "method",
        setterName: "foo",
        argsAndBodySource: `(v) {}`,
      },
    );
  }
}
