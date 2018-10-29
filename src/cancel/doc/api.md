# API

* [createCancel()](#createCancel)
* [cancellation](#cancellation)
* [cancellation.isRequested()](#cancellation-is-requested)
* [cancellation.wrap(fn)](#cancellation-wrap-fn)
* [cancel()](#cancel)

## createCancel()

createCancel returns `{ cancellation, cancel }`

```js
import { createCancel } from "@dmail/cancel"

const { cancellation, cancel } = createCancel()

typeof cancellation // 'object'
typeof cancel // 'function'
```

## cancellation

A cancellation object is composed of `{ isRequested, register, wrap }`.

```js
import { createCancel } from "@dmail/cancel"

const { cancellation } = createCancel()
const { isRequested, wrap, register } = cancellation

typeof isRequested // 'function'
typeof register // 'function'
typeof wrap // 'function'
```

## cancellation.isRequested()

Returns false as long as cancel is not called.
You can use this method to avoid doing more stuff because cancellation is requested.

```js
import { createCancel } from "@dmail/cancel"

const { cancellation, cancel } = createCancel()

cancellation.isRequested() // false
cancel()
cancellation.isRequested() // true
```

However you should prefer [cancellation.wrap(fn)](#cancellation-is-fn)

## cancellation.wrap(fn)

Returns a promise that will either

* reject if calling fn() throw
* remains pending forever if cancel() is called
* resolve to fn() return value

```js
import { createCancel } from "@dmail/cancel"

{
  const { cancellation } = createCancel()

  cancellation
    .wrap(() => {
      throw "foo"
    })
    .catch((error) => {
      error // 'foo'
    })
}

{
  const { cancellation, cancel } = createCancel()

  const promise = cancellation.wrap(() => Promise.resolve(true))
  cancel()
  promise.then(() => {
    // this will never be called
  })
}

{
  const { cancellation } = createCancel()

  const promise = cancellation.wrap(() => Promise.resolve(true))
  promise.then((value) => {
    value // true
  })
}
```

## cancel()
