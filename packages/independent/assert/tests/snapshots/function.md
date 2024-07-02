# async arrow function vs arrow function

```js
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
```

![img](<./function/async_arrow_function_vs_arrow_function.svg>)

# arrow function source modified, name same

```js
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
```

![img](<./function/arrow_function_source_modified__name_same.svg>)

# async function vs function

```js
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
```

![img](<./function/async_function_vs_function.svg>)

# function vs arrow function

```js
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
```

![img](<./function/function_vs_arrow_function.svg>)

# function source modified, name same

```js
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
```

![img](<./function/function_source_modified__name_same.svg>)

# function source same, name modified

```js
assert({
  actual: function foo() {},
  expect: function bar() {},
});
```

![img](<./function/function_source_same__name_modified.svg>)

# anonymous function vs named function

```js
const anonymousFunction = (function () {
  return function () {};
})();
function foo() {}
assert({
  actual: anonymousFunction,
  expect: foo,
});
```

![img](<./function/anonymous_function_vs_named_function.svg>)

# number of diff when comparing async function and function

```js
const anonymousAsyncFunction = (function () {
  return async function () {};
})();
const anonymousFunction = (function () {
  return function () {};
})();
assert({
  actual: {
    a: anonymousAsyncFunction,
    b: true,
  },
  expect: {
    a: anonymousFunction,
    b: false,
  },
});
```

![img](<./function/number_of_diff_when_comparing_async_function_and_function.svg>)

# function prototype modified

```js
function Foo() {}
Foo.prototype.a = true;
Foo.prototype.b = false;
function Bar() {}
Bar.prototype.a = true;
Bar.prototype.b = true;
assert({
  actual: Foo,
  expect: Bar,
});
```

![img](<./function/function_prototype_modified.svg>)

# function prototype added

```js
function Foo() {}
function Bar() {}
Bar.prototype.a = true;
assert({
  actual: Foo,
  expect: Bar,
});
```

![img](<./function/function_prototype_added.svg>)

# class vs function

```js
assert({
  actual: class {},
  expect: function () {},
});
```

![img](<./function/class_vs_function.svg>)

# class Animal vs class Robot

```js
assert({
  actual: class Animal {},
  expect: class Robot {},
});
```

![img](<./function/class_animal_vs_class_robot.svg>)

# extends Animal vs extend Robot

```js
class Animal {
  static type = "animal";
}
class Robot {
  static type = "robot";
}
assert({
  actual: class Human extends Animal {
    static type = "human_actual";
  },
  expect: class Human extends Robot {
    static type = "human_expected";
  },
});
```

![img](<./function/extends_animal_vs_extend_robot.svg>)

# class static property modified

```js
assert({
  actual: class A {
    static a = true;
  },
  expect: class A {
    static a = false;
  },
});
```

![img](<./function/class_static_property_modified.svg>)

# class static property added

```js
assert({
  actual: class A {
    static a = true;
  },
  expect: class A {},
});
```

![img](<./function/class_static_property_added.svg>)

# class static property removed

```js
assert({
  actual: class A {},
  expect: class A {
    static a = false;
  },
});
```

![img](<./function/class_static_property_removed.svg>)

# class method diff source

```js
const anonymousActualClass = (function () {
  return class {
    a() {
      return true;
    }
  };
})();
const anonymousExpectClass = (function () {
  return class {
    a() {
      return false;
    }
  };
})();
assert({
  actual: anonymousActualClass,
  expect: anonymousExpectClass,
});
```

![img](<./function/class_method_diff_source.svg>)

# class method added

```js
assert({
  actual: class A {
    a() {}
  },
  expect: class A {},
});
```

![img](<./function/class_method_added.svg>)

# class method removed

```js
assert({
  actual: class A {},
  expect: class A {
    a() {}
  },
});
```

![img](<./function/class_method_removed.svg>)

# class constructor modified

```js
assert({
  actual: class {
    constructor() {
      console.log("actual");
    }
  },
  expect: class {
    constructor() {
      console.log("expect");
    }
  },
});
```

![img](<./function/class_constructor_modified.svg>)

# arrow function source same, name modified

```js
const foo = () => {};
const bar = () => {};
assert({
  actual: {
    a: foo,
    b: true,
  },
  expect: {
    a: bar,
    b: false,
  },
});
```

![img](<./function/arrow_function_source_same__name_modified.svg>)

# arrow function source same, name same

```js
const fn = () => {};
assert({
  actual: {
    a: fn,
    b: true,
  },
  expect: {
    a: fn,
    b: false,
  },
});
```

![img](<./function/arrow_function_source_same__name_same.svg>)

# class constructor added

```js
assert({
  actual: class {
    constructor() {
      console.log("actual");
    }
  },
  expect: class {},
});
```

![img](<./function/class_constructor_added.svg>)

# class constructor removed

```js
assert({
  actual: class {},
  expect: class {
    constructor() {
      console.log("expect");
    }
  },
});
```

![img](<./function/class_constructor_removed.svg>)

# static property value modified

```js
const anonymousActualClass = (function () {
  return class {
    a = "a_prop"; // class properties cannot be listed so it won't be catched
    static a = "a_static";
  };
})();
const anonymousExpectClass = (function () {
  return class {
    a = "a_prop_2";
    static a = "a_static_2";
  };
})();
assert({
  actual: anonymousActualClass,
  expect: anonymousExpectClass,
});
```

![img](<./function/static_property_value_modified.svg>)

# static method return value modified

```js
const anonymousActualClass = (function () {
  return class {
    static a() {
      return true;
    }
  };
})();
const anonymousExpectClass = (function () {
  return class {
    static a() {
      return false;
    }
  };
})();
assert({
  actual: anonymousActualClass,
  expect: anonymousExpectClass,
});
```

![img](<./function/static_method_return_value_modified.svg>)

# class static property and object property

```js
assert({
  actual: class {
    static a = true;
    static b = true;
  },
  expect: {
    a: true,
    b: false,
  },
});
```

![img](<./function/class_static_property_and_object_property.svg>)

# class static prop and function prop

```js
assert({
  actual: class {
    static a = true;
  },
  expect: Object.assign(function () {}, {
    a: true,
  }),
});
```

![img](<./function/class_static_prop_and_function_prop.svg>)

# class prototype method vs function prototype method

```js
const toto = function () {};
toto.a = true;
toto.prototype.b = () => {};
assert({
  actual: class {
    static a = true;
    b() {}
  },
  expect: toto,
});
```

![img](<./function/class_prototype_method_vs_function_prototype_method.svg>)

# class constructor vs function

```js
assert({
  actual: class {
    constructor() {
      console.log("actual");
    }
  },
  expect: function () {
    console.log("expect");
  },
});
```

![img](<./function/class_constructor_vs_function.svg>)

