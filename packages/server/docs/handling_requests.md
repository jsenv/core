# Handling requests

Request are handled by the first service returning something in a "handleRequest" function.

```js
import { startServer } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: () => {
        return {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: "Hello world",
        };
      },
    },
  ],
});
```

## handleRequest

_handleRequest_ is a function responsible to generate a response from a request.

- It is optional
- It receives a _request_ object in argument
- It is expected to return a _response_, `null` or `undefined`
- It can be an async function

When there is no service handling the request, server respond with _501 Not implemented_.

## request

_request_ is an object representing an http request.
_request_ are passed as first argument to _handleRequest_.

_Request object example_

```js
const request = {
  signal,
  http2: false,
  url: "http://127.0.0.1:8080/index.html?param=1",
  origin: "http://127.0.0.1:8080",
  pathname: "/index.html",
  resource: "/index.html?param=1",
  method: "GET",
  headers: { accept: "text/html" },
  body,
};
```

### Reading request search params

```js
import { startServer } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: async (request) => {
        const page = new URL(request.url).searchParams.get("page");
      },
    },
  ],
});
```

Read more at https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams.

### Reading request body

```js
import { startServer, readRequestBody } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: async (request) => {
        const requestBodyAsString = await readRequestBody(request);
        const requestBodyAsJson = await readRequestBody(request, {
          as: "json",
        });
        const requestBodyAsBuffer = await readRequestBody(request, {
          as: "buffer",
        });
      },
    },
  ],
});
```

## response

_response_ is an object describing a server response. See below some examples that you could return in [handleRequest](#handleRequest)

_response body declared with a string_

```js
import { startServer } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: () => {
        const response = {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: "Hello world",
        };
        return response;
      },
    },
  ],
});
```

_response body declared with a buffer_

```js
import { startServer } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: () => {
        const response = {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: Buffer.from("Hello world"),
        };
        return response;
      },
    },
  ],
});
```

_response body declared with a readable stream_

```js
import { createReadStream } from "node:fs";
import { startServer } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: () => {
        const response = {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: createReadStream("/User/you/folder/file.txt"),
        };
        return response;
      },
    },
  ],
});
```

_response body declared with an observable_

```js
import { startServer } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: () => {
        const response = {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: {
            [Symbol.observable]: () => {
              return {
                subscribe: ({ next, complete }) => {
                  next("Hello world");
                  complete();
                },
              };
            },
          },
        };
        return response;
      },
    },
  ],
});
```

## Services and composition

Composition allows to split complex server logic into smaller units.
The following code is an example of composition where a server logic is split in two functions.

```js
/*
 * starts a server which:
 * - when requested at "/"
 *   -> respond with 200
 * - otherwise
 *   -> respond with 404
 */
import { startServer, composeServices } from "@jsenv/server";

await startServer({
  services: [
    {
      name: "index",
      handleRequest: (request) => {
        if (request.resource === "/") {
          return { status: 200 };
        }
        return null; // means "I don't handle that request"
      },
    },
    {
      name: "otherwise",
      handleRequest: () => {
        return { status: 404 };
      },
    },
  ],
});
```

<!-- > Code above implement a server that could be described as follow:
>
> - when requested at `/`, respond with `204`
> - when requested at `/whatever`, respond with `200` -->

<!-- A service can be described as an async function receiving a request and returning a response or null.

On a real use case _requestToResponse_ needs to be splitted into smaller functions (services) to keep it maintainable. `@jsenv/server` provides an helper for this called _composeService_. It is an async function returning the first response produced by a list of async functions called in sequence. -->
