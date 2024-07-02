import { parseFunction } from "@jsenv/assert/src/utils/function_parser.js";

import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

const generateFunctionBody = (fn) => {
  const body = parseFunction(fn).body;
  const error = new Error();
  error.stack = body;
  throw error;
};

await startSnapshotTesting("function_body", {
  ["arrow function containing arrow function"]: () => {
    generateFunctionBody(() => {
      const a = () => {};
      a();
    });
  },
  ["anonymous arrow default param arrow"]: () => {
    generateFunctionBody((a = () => {}) => {
      return a;
    });
  },
  ["anonymous arrow returning string"]: () => {
    generateFunctionBody(() => {
      return "yo";
    });
  },
  ["anonymous arrow one liner object notation"]: () => {
    generateFunctionBody(() => ({}));
  },
  ["anonymous function returning a + b"]: () => {
    generateFunctionBody(function (a, b) {
      return a + b;
    });
  },
  ["named arrow function"]: () => {
    generateFunctionBody(
      {
        a: () => {
          console.log(10);
        },
      }.a,
    );
  },
  ["named function returning a + b"]: () => {
    generateFunctionBody(
      // prettier-ignore
      function name  ( a,  b )   {
        return a + b;
      },
    );
  },
  ["getter returning 10"]: () => {
    generateFunctionBody(
      Object.getOwnPropertyDescriptor(
        {
          // prettier-ignore
          get   a()  {
            return 10;
          },
        },
        "a",
      ).get,
    );
  },
  ["setter incrementing value"]: () => {
    generateFunctionBody(
      Object.getOwnPropertyDescriptor(
        {
          /* eslint-disable accessor-pairs */
          // prettier-ignore
          set   name ( value )  {
            value++
            
          },
          /* eslint-enable accessor-pairs */
        },
        "name",
      ).set,
    );
  },
});
