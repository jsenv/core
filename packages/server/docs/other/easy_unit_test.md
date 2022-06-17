## Easy to unit test

> **Disclaimer**
>
> Code written for an HTTP server is easy to test, independently from the library and language:
>
> 1. start the server
> 2. send specific http request to that server
> 3. for each http request sent, assert the http response from server is expected.
>
> And this type of test should be favored because they are closer to the final behaviour of an http server. That being said, this section is still useful to illustrates how pure function are easy to unit test because they are independent from their environment. And this aspect of pure function makes code way easier to reason about.

Let's take the code from the previous part on [Composition](#Composition) and write unit test for it

_server.js:_

```js
import { startServer, composeServices } from "@jsenv/server"

const noContentService = (request) => {
  if (request.ressource !== "/") return null
  return { status: 204 }
}

const okService = (request) => {
  if (request.ressource !== "/whatever") return null
  return { status: 200 }
}

startServer({
  requestToResponse: composeServices({
    noContentService,
    okService,
  }),
})

// unit test exports
export { noContentService, okService }
```

_server.test.js:_

```js
import { noContentService, okService } from "./server.js"
import assert from "assert"

// okService returns 200 on /whatever
{
  const actual = okService({ ressource: "/whatever" })
  const expected = { status: 200 }
  assert.equal(actual, expected)
}

// okService returns 200 only on /whatever
{
  const actual = okService({ ressource: "/" })
  const expected = null
  assert.equal(actual, expected)
}

// noContentService returns 204 on /
{
  const actual = noContentService({ ressource: "/" })
  const expected = { status: 204 }
  assert.equal(actual, expected)
}

// noContentService returns 204 only on /
{
  const actual = noContentService({ ressource: "/toto" })
  const expected = null
  assert.equal(actual, expected)
}
```
