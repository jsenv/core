/* eslint-disable object-shorthand */
/*
 * Too keep in mind:
 * - runtime cannot know class properties
 *   class {
 *     a = true;
 *   }
 * - runtime cannot know static blocks
 *   class {
 *     static {
 *       console.log('here');
 *     }
 *   }
 * As a result a diff in those parts will still be detected in by assert
 * because we compare the class source code using classFunction.toString()
 * but won't be visible in the diff message
 * - At runtime you cannot know if a class defines a constructor or not
 */

import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("function", {
  ["async arrow function vs arrow function"]: () => {
    const anonymousAsyncArrowFunction = (function () {
      return async () => {};
    })();
    const anonymousArrowFunction = (function () {
      return () => {};
    })();
    assert({
      actual: anonymousAsyncArrowFunction,
      expect: anonymousArrowFunction,
    });
  },
  ["arrow function source modified, name same"]: () => {
    const anonymousArrowReturningTrue = (function () {
      return () => true;
    })();
    const anonymousArrowReturningFalse = (function () {
      return () => false;
    })();
    assert({
      actual: anonymousArrowReturningTrue,
      expect: anonymousArrowReturningFalse,
    });
  },
  ["async function vs function"]: () => {
    const anonymousAsyncFunction = (function () {
      return async function () {};
    })();
    const anonymousFunction = (function () {
      return function () {};
    })();
    assert({
      actual: anonymousAsyncFunction,
      expect: anonymousFunction,
    });
  },
  ["function vs arrow function"]: () => {
    const anonymousFunction = (function () {
      return function () {};
    })();
    const anonymousArrowFunction = (function () {
      return () => {};
    })();
    assert({
      actual: anonymousFunction,
      expect: anonymousArrowFunction,
    });
  },
  ["function source modified, name same"]: () => {
    const anonymousFunctionReturningTrue = (function () {
      return function () {
        return true;
      };
    })();
    const anonymousFunctionReturningFalse = (function () {
      return function () {
        return false;
      };
    })();
    assert({
      actual: anonymousFunctionReturningTrue,
      expect: anonymousFunctionReturningFalse,
    });
  },
  ["function source same, name modified"]: () => {
    assert({
      actual: function foo() {},
      expect: function bar() {},
    });
  },
  ["anonymous function vs named function"]: () => {
    const anonymousFunction = (function () {
      return function () {};
    })();
    function foo() {}
    assert({
      actual: anonymousFunction,
      expect: foo,
    });
  },
  // ["number of diff when comparing async function and function"]: () => {
  //   const anonymousAsyncFunction = (function () {
  //     return async function () {};
  //   })();
  //   const anonymousFunction = (function () {
  //     return function () {};
  //   })();
  //   assert({
  //     actual: {
  //       a: anonymousAsyncFunction,
  //       b: true,
  //     },
  //     expect: {
  //       a: anonymousFunction,
  //       b: false,
  //     },
  //   });
  // },
  // ["function prototype modified"]: () => {
  //   function Foo() {}
  //   Foo.prototype.a = true;
  //   Foo.prototype.b = false;
  //   function Bar() {}
  //   Bar.prototype.a = true;
  //   Bar.prototype.b = true;
  //   assert({
  //     actual: Foo,
  //     expect: Bar,
  //   });
  // },
  // ["function prototype added"]: () => {
  //   function Foo() {}
  //   function Bar() {}
  //   Bar.prototype.a = true;
  //   assert({
  //     actual: Foo,
  //     expect: Bar,
  //   });
  // },
  // ["class vs function"]: () => {
  //   assert({
  //     actual: class {},
  //     expect: function () {},
  //   });
  // },
  // ["class Animal vs class Robot"]: () => {
  //   assert({
  //     actual: class Animal {},
  //     expect: class Robot {},
  //   });
  // },
  // ["extends Animal vs extend Robot"]: () => {
  //   class Animal {
  //     static type = "animal";
  //   }
  //   class Robot {
  //     static type = "robot";
  //   }
  //   assert({
  //     actual: class Human extends Animal {
  //       static type = "human_actual";
  //     },
  //     expect: class Human extends Robot {
  //       static type = "human_expected";
  //     },
  //   });
  // },
  // ["class static property modified"]: () => {
  //   assert({
  //     actual: class A {
  //       static a = true;
  //     },
  //     expect: class A {
  //       static a = false;
  //     },
  //   });
  // },
  // ["class static property added"]: () => {
  //   assert({
  //     actual: class A {
  //       static a = true;
  //     },
  //     expect: class A {},
  //   });
  // },
  // ["class static property removed"]: () => {
  //   assert({
  //     actual: class A {},
  //     expect: class A {
  //       static a = false;
  //     },
  //   });
  // },
  // ["class method diff source"]: () => {
  //   const anonymousActualClass = (function () {
  //     return class {
  //       a() {
  //         return true;
  //       }
  //     };
  //   })();
  //   const anonymousExpectClass = (function () {
  //     return class {
  //       a() {
  //         return false;
  //       }
  //     };
  //   })();
  //   assert({
  //     actual: anonymousActualClass,
  //     expect: anonymousExpectClass,
  //   });
  // },
  // ["class method added"]: () => {
  //   assert({
  //     actual: class A {
  //       a() {}
  //     },
  //     expect: class A {},
  //   });
  // },
  // ["class method removed"]: () => {
  //   assert({
  //     actual: class A {},
  //     expect: class A {
  //       a() {}
  //     },
  //   });
  // },
  // ["class constructor modified"]: () => {
  //   assert({
  //     actual: class {
  //       constructor() {
  //         console.log("actual");
  //       }
  //     },
  //     expect: class {
  //       constructor() {
  //         console.log("expect");
  //       }
  //     },
  //   });
  // },
  // // arrow function name is infered and does not matter so it's ignored
  // // by the diff inside "assert"
  // // ->in the test below the name are different but will not be displayed in the diff
  // ["arrow function source same, name modified"]: () => {
  //   const foo = () => {};
  //   const bar = () => {};
  //   assert({
  //     actual: {
  //       a: foo,
  //       b: true,
  //     },
  //     expect: {
  //       a: bar,
  //       b: false,
  //     },
  //   });
  // },
  // ["arrow function source same, name same"]: () => {
  //   const fn = () => {};
  //   assert({
  //     actual: {
  //       a: fn,
  //       b: true,
  //     },
  //     expect: {
  //       a: fn,
  //       b: false,
  //     },
  //   });
  // },
  // // as shown in the diff class without constructor still got a constructor property
  // // so the 2 tests below does not provide a very accurate diff
  // ["class constructor added"]: () => {
  //   assert({
  //     actual: class {
  //       constructor() {
  //         console.log("actual");
  //       }
  //     },
  //     expect: class {},
  //   });
  // },
  // ["class constructor removed"]: () => {
  //   assert({
  //     actual: class {},
  //     expect: class {
  //       constructor() {
  //         console.log("expect");
  //       }
  //     },
  //   });
  // },
  // ["static property value modified"]: () => {
  //   const anonymousActualClass = (function () {
  //     return class {
  //       a = "a_prop"; // class properties cannot be listed so it won't be catched
  //       static a = "a_static";
  //     };
  //   })();
  //   const anonymousExpectClass = (function () {
  //     return class {
  //       a = "a_prop_2";
  //       static a = "a_static_2";
  //     };
  //   })();
  //   assert({
  //     actual: anonymousActualClass,
  //     expect: anonymousExpectClass,
  //   });
  // },
  // ["static method return value modified"]: () => {
  //   const anonymousActualClass = (function () {
  //     return class {
  //       static a() {
  //         return true;
  //       }
  //     };
  //   })();
  //   const anonymousExpectClass = (function () {
  //     return class {
  //       static a() {
  //         return false;
  //       }
  //     };
  //   })();
  //   assert({
  //     colors: false,
  //     actual: anonymousActualClass,
  //     expect: anonymousExpectClass,
  //   });
  // },
  // ["class static property and object property"]: () => {
  //   assert({
  //     actual: class {
  //       static a = true;
  //       static b = true;
  //     },
  //     expect: {
  //       a: true,
  //       b: false,
  //     },
  //   });
  // },
  // ["class static prop and function prop"]: () => {
  //   assert({
  //     actual: class {
  //       static a = true;
  //     },
  //     expect: Object.assign(function () {}, {
  //       a: true,
  //     }),
  //   });
  // },
  // ["class prototype method vs function prototype method"]: () => {
  //   const toto = function () {};
  //   toto.a = true;
  //   toto.prototype.b = () => {};
  //   assert({
  //     actual: class {
  //       static a = true;
  //       b() {}
  //     },
  //     expect: toto,
  //   });
  // },
  // ["class constructor vs function"]: () => {
  //   assert({
  //     actual: class {
  //       constructor() {
  //         console.log("actual");
  //       }
  //     },
  //     expect: function () {
  //       console.log("expect");
  //     },
  //   });
  // },
});
