import { parseFunction } from "@jsenv/assert/src/utils/function_parser.js";
import { snapshotAssertTests } from "@jsenv/assert/tests/snapshot_assert.js";

const generateFunctionBody = (fn) => {
  const body = parseFunction(fn).body;
  return body;
};

await snapshotAssertTests(import.meta.url, ({ test }) => {
  test("arrow function containing arrow function", () =>
    generateFunctionBody(() => {
      const a = () => {};
      a();
    }));
  test("async arrow function", () =>
    generateFunctionBody(async () => {
      console.log("async_body");
    }));
  test("anonymous arrow default param arrow", () =>
    generateFunctionBody((a = () => {}) => {
      return a;
    }));
  test("anonymous arrow returning string", () =>
    generateFunctionBody(() => {
      return "yo";
    }));
  test("anonymous arrow one liner object notation", () =>
    generateFunctionBody(() => ({})));
  test("anonymous function returning a + b", () =>
    generateFunctionBody(function (a, b) {
      return a + b;
    }));
  test("named arrow function", () =>
    generateFunctionBody(
      {
        a: () => {
          console.log(10);
        },
      }.a,
    ));
  test("named function returning a + b", () => {
    return generateFunctionBody(
      // prettier-ignore
      function name  ( a,  b )   {
        return a + b;
      },
    );
  });
  test("getter returning 10", () =>
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
    ));
  test("setter incrementing value", () =>
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
    ));
});
