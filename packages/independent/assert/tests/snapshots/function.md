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

![img](<./function/async arrow function vs arrow function.svg>)

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

![img](<./function/arrow function source modified, name same.svg>)

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

![img](<./function/async function vs function.svg>)

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

![img](<./function/function vs arrow function.svg>)

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

![img](<./function/function source modified, name same.svg>)

# function source same, name modified

```js
assert({
  actual: function foo() {},
  expect: function bar() {},
});
```

![img](<./function/function source same, name modified.svg>)

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

![img](<./function/anonymous function vs named function.svg>)

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

![img](<./function/number of diff when comparing async function and function.svg>)

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

![img](<./function/function prototype modified.svg>)

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

![img](<./function/function prototype added.svg>)

# class vs function

```js
assert({
  actual: class {},
  expect: function () {},
});
```

![img](<./function/class vs function.svg>)

# class Animal vs class Robot

```js
assert({
  actual: class Animal {},
  expect: class Robot {},
});
```

![img](<./function/class Animal vs class Robot.svg>)

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

![img](<./function/extends Animal vs extend Robot.svg>)

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

![img](<./function/class static property modified.svg>)

# class static property added

```js
assert({
  actual: class A {
    static a = true;
  },
  expect: class A {},
});
```

![img](<./function/class static property added.svg>)

# class static property removed

```js
assert({
  actual: class A {},
  expect: class A {
    static a = false;
  },
});
```

![img](<./function/class static property removed.svg>)

