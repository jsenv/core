# Handling requests

Request are handled by the first service returning something in a "handleRequest" function.

```js
import { startServer } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: {
        "GET /": () => {
          return {
            status: 200,
            headers: { "content-type": "text/plain" },
            body: "Hello world",
          };
        },
      },
    },
  ],
});
```

## handleRequest

_handleRequest_ is an object associating routes to functions responsible to generate a response from a request.

- It is optional
- Each function receives a _request_ object in argument
- Each function is expected to return a _response_, `null` or `undefined`
- Function can be an `async`

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
  searchParams: new URLSearchParams("?param=1"),
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
      handleRequest: {
        "GET *": async (request) => {
          const page = request.searchParams.get("page");
        },
      },
    },
  ],
});
```

Read more at https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams.

### Reading request body

Pass an object with accepted request content-types to the route declared on `handleRequest`.  
The request body will be passed to your function. If the request uses a content-type you do not support a reponse with status 415 (Unsupported Media Type) will be sent automatically.

```js
import { startServer } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: {
        "PATCH /users/:id": {
          "application/json": async (request, { id }) => {
            const requestBodyJson = await request.json();
            return {
              status: 200,
              headers: { "content-type": "text/plain" },
              body: 'Server have received "application/json" body',
            };
          },
          "application/merge-patch+json": async (request, { id }) => {
            const requestBodyJson = await request.json();
            return {
              status: 200,
              headers: { "content-type": "text/plain" },
              body: 'Server have received "merge-patch+json" body',
            };
          },
          "multipart/form-data": async (request, { id }) => {
            const { fields, files } = await request.formData();
            return {
              status: 200,
              headers: { "content-type": "text/plain" },
              body: 'Server have received "multipart/form-data" body',
            };
          },
          "application/x-www-form-urlencoded": async (request, { id }) => {
            const requestBodyFields = await request.queryString();
            return {
              status: 200,
              headers: { "content-type": "text/plain" },
              body: 'Server have received "application/x-www-form-urlencoded" body',
            };
          },
          "text/plain": async (request, { id }) => {
            const requestBodyText = await request.text();
            return {
              status: 200,
              headers: { "content-type": "text/plain" },
              body: 'Server have received "text/plain" body',
            };
          },
          "application/octet-stream": async (request, { id }) => {
            const requestBodyBuffer = await request.buffer();
            return {
              status: 200,
              headers: { "content-type": "text/plain" },
              body: 'Server have received "application/octet-stream" body',
            };
          },
        },
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
      handleRequest: {
        "GET /": () => {
          const response = {
            status: 200,
            headers: { "content-type": "text/plain" },
            body: "Hello world",
          };
          return response;
        },
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
      handleRequest: {
        "GET /": () => {
          const response = {
            status: 200,
            headers: { "content-type": "text/plain" },
            body: Buffer.from("Hello world"),
          };
          return response;
        },
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
      handleRequest: {
        "GET /": () => {
          const response = {
            status: 200,
            headers: { "content-type": "text/plain" },
            body: createReadStream("/User/you/folder/file.txt"),
          };
          return response;
        },
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
      handleRequest: {
        "GET /": () => {
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
      handleRequest: {
        "GET /": (request) => {
          return { status: 200 };
        },
        "GET *": () => {
          return { status: 404 };
        },
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
