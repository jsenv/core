import { getFunctionBody } from "@jsenv/assert/src/get_function_body.js";

import { startSnapshotTesting } from "./start_snapshot_testing.js";

const generateFunctionBody = (fn) => {
  const body = getFunctionBody(fn);
  const error = new Error();
  error.stack = body;
  throw error;
};

await startSnapshotTesting("function_body", {
  ["anonymous arrow returning string"]: () => {
    generateFunctionBody(() => {
      return "yo";
    });
  },
  ["anonymous arrow one liner object notation"]: () => {
    generateFunctionBody(() => ({}));
  },
  ["anonymous arrow default param arrow"]: () => {
    generateFunctionBody((a = () => {}) => {
      return a;
    });
  },
  ["anonymous function returning a + b"]: () => {
    generateFunctionBody(function (a, b) {
      return a + b;
    });
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
});
