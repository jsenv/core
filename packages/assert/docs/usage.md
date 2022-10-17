# Usage

How to use _@jsenv/assert_ in 3 parts:

1. Using _@jsenv/assert_ in Node.js
2. Using _@jsenv/assert_ in a browser
3. Writing tests with _@jsenv/assert_

## Using _@jsenv/assert_ in Node.js

```console
npm i --save-dev @jsenv/assert
```

```js
import { assert } from "@jsenv/assert"
```

## Using _@jsenv/assert_ in a browser

1 - Using a CDN

```html
<script type="module">
  import { assert } from "https://unpkg.com/@jsenv/assert@latest/src/main.js"
</script>
```

2 - Using NPM

```console
npm i --save-dev @jsenv/assert
```

```html
<script type="module">
  import { assert } from "@jsenv/assert"

  assert({
    actual: true,
    expected: false,
  })
</script>
```

# Writing tests with _@jsenv/assert_

This part contain recommendations on how to write tests using _@jsenv/assert_.
These guidelines helps to write consistent tests and illustrates how _@jsenv/assert_ is meant to be used.

After an introduction on the AAA pattern, several practical examples are shown.

## The AAA pattern

It is recommended to use the AAA pattern in your test files. "AAA" stands for Arrange, Act, Assert.
You are certainly already using AAA without noticing but it's still good to be aware of the concept.

This pattern is referenced in Node.js best practices:

> Structure your tests with 3 well-separated sections: Arrange, Act & Assert (AAA).
>
> — Yoni Goldberg in [Structure tests by the AAA pattern](https://github.com/goldbergyoni/nodebestpractices/blob/061bd10c2a4e2ba3407d9e1205b0fe702ef82b57/sections/testingandquality/aaa.md)

You can also check the following medium article for an other point of view.

> The AAA (Arrange-Act-Assert) pattern has become almost a standard across the industry.
>
> — Paulo Gomes in [Unit Testing and the Arrange, Act and Assert (AAA) Pattern](https://medium.com/@pjbgf/title-testing-code-ocd-and-the-aaa-pattern-df453975ab80)

## Practical examples

### Assert a function throws

_circle.js_

```js
export const getCircleArea = (circleRadius) => {
  if (isNaN(circleRadius)) {
    throw new TypeError(
      `circleRadius must be a number, received ${circleRadius}`,
    )
  }
  return circleRadius * circleRadius * Math.PI
}
```

_circle.test.js_

```js
import { assert } from "@jsenv/assert"
import { getCircleArea } from "./circle.js"

try {
  getCircleArea("toto")
  throw new Error("should throw") // this line throw if getCircleArea does not throw as it should
} catch (error) {
  const actual = error
  const expected = new TypeError(`circleRadius must be a number, received toto`)
  assert({ actual, expected })
}
```

### Assert an async function throws

If _getCircleArea_ from previous example was async, add _await_ in front of it.

```diff
try {
-  getCircleArea("toto")
+  await getCircleArea("toto")
  throw new Error("should throw") // this line throw if getCircleArea does not throw as it should
} catch(e) {
```

### Assert a callback is called

_abort_signal.js_

```js
export const createAbortSignal = () => {
  const abortSignal = {
    onabort: () => {},
    abort: () => {
      abortSignal.onabort()
    },
  }

  return abortSignal
}
```

_abort_signal.test.js_

```js
// This test ensures calling abortSignal.abort is calling abortSignal.onabort()
import { assert } from "@jsenv/assert"
import { createAbortSignal } from "./abort_signal.js"

// arrange
const abortSignal = createAbortSignal()
let called = false
abortSignal.onabort = () => {
  called = true
}

// act
abortSignal.abort()

// assert
const actual = called
const expected = true
assert({ actual, expected })
```

> Code above is a great example of [the AAA pattern](#The-AAA-pattern).

### Assert callback will be called

_call_me_maybe.js_

```js
export const callAfter50Ms = (callback) => {
  setTimeout(callback, 50)
}
```

_call_me_maybe.test.js_

```js
import { assert } from "@jsenv/assert"
import { callAfter50Ms } from "./call_me_maybe.js"

let called = false
callAfter50Ms(() => {
  called = true
})

// Wait 80ms, then assert callback was called
await new Promise((resolve) => setTimeout(resolve, 80))

const actual = called
const expected = true
assert({ actual, expected })
```

### Assert any value of a given type

_user.js_

```js
export const createUser = () => {
  return {
    name: "sam",
    creationTime: Date.now(),
  }
}
```

_user.test.js_

```js
import { assert } from "@jsenv/assert"
import { createUser } from "./user.js"

const user = createUser()
const actual = user
const expected = {
  name: "sam",
  creationTime: assert.any(Number),
}
assert({ actual, expected })
```

### Assert an other value

_randomize_user_name.js_

```js
export const getRandomDifferentUserName = (user) => {
  const randomName = getRandomName()
  if (randomName === user.name) {
    return getRandomDifferentUserName(user)
  }
  return randomName
}

const getRandomName = () => {
  return Array.from({ length: 4 })
    .map(() => getRandomLetter())
    .join("")
}

const getRandomLetter = () => {
  return ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length))
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyz"
```

_randomize_user_name.test.js_

```js
// Here we want to ensure the value returned by getRandomDifferentUserName
// is not the curent user name, the value itself is not important
import { assert } from "@jsenv/assert"
import { getRandomDifferentUserName } from "./_randomize_user_name.js"

const name = getRandomDifferentUserName({ name: "toto" })
const actual = name
const expected = assert.not("toto")
assert({ actual, expected })
```

### Assert subset of properties

_user.js_

```js
export const getUser = () => {
  return {
    name: "sam",
    age: 32,
    friends: [], // poor sam :(
  }
}
```

_user.test.js_

```js
// Here it is assumed that the important thing to tests are
// the user "name" and "age", the user object is allowed to have more properties
import { assert } from "@jsenv/assert"
import { getUser } from "./user.js"

const user = getUser()
const actual = { name: user.name, age: user.age }
const expected = { name: "sam", age: 32 }
assert({ actual, expected })
```

### Assert without property order constraint

_user.js_

```js
export const getUser = () => {
  return {
    name: "sam",
    age: 32,
  }
}
```

_user.test.js_

```js
// Here it is assumed that user object properties order is not important
import { assert } from "@jsenv/assert"
import { getUser } from "./user.js"

const user = getUser()
const actual = { age: user.age, name: user.name }
const expected = { age: 32, name: "sam" }
assert({ actual, expected })
```
