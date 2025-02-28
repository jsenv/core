# Handling requests

Request are handled by the first route matching and with "response" function returning something.

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      response: () => {
        return new Response("Hello world");
      },
    },
  ],
});
```

## response

_response_ is a function responsible to generate a response from a request.

- It is expected to return a _response_, `null` or `undefined`
- It can be an `async`

When there is no route producing a response for the request, server respond with _501 Not implemented_.

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
  routes: [
    {
      endpoint: "GET /",
      response: (request) => {
        const page = request.searchParams.get("page");
      },
    },
    // OR
    {
      endpoint: "GET /?page=:page",
      response: (request) => {
        const { page } = request.params;
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
  routes: [
    {
      endpoint: "PATCH /users/:id",
      acceptedContentTypes: [
        "application/json",
        "application/merge-patch+json",
        "multipart/form-data",
        "application/x-www-form-urlencoded",
        "text/plain",
        "application/octet-stream",
      ],
      response: async (request) => {
        const { id } = request.params;
        const requestContentType = request.headers["content-type"];
        if (requestContentType === "application/json") {
          const requestBodyJson = await request.json();
          return new Response(`Server have received "application/json" body`);
        }
        if (requestContentType === "application/merge-patch+json") {
          const requestBodyJson = await request.json();
          return new Response(`Server have received "merge-patch+json" body`);
        }
        if (requestContentType === "multipart/form-data") {
          const { fields, files } = await request.formData();
          return new Response(
            `Server have received "multipart/form-data" body`,
          );
        }
        if (requestContentType === "application/x-www-form-urlencoded") {
          const requestBodyFields = await request.queryString();
          return new Response(
            `Server have received "application/x-www-form-urlencoded" body`,
          );
        }
        if (requestContentType === "application/x-www-form-urlencoded") {
          const requestBodyText = await request.text();
          return new Response(`Server have received "text/plain" body`);
        }
        // "application/octet-stream"
        const requestBodyBuffer = await request.buffer();
        return new Response(
          `Server have received "application/octet-stream" body`,
        );
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
  routes: [
    {
      endpoint: "GET /",
      response: () => {
        return new Response("Hello world");
      },
    },
  ],
});
```

_response body declared with a buffer_

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      response: () => {
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
  routes: [
    {
      endpoint: "GET /",
      response: () => {
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
  routes: [
    {
      endpoint: "GET /",
      response: () => {
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

<!-- ## Routes and composition

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
  routes: [
    {
      url: "/",
      method: "GET",
      response: () => ({ status: 200 }),
    },
    {
      url: "*",
      method: "GET",
      response: () => ({ status: 404 }),
    },
  ],
}); -->

```

<!-- > Code above implement a server that could be described as follow:
>
> - when requested at `/`, respond with `204`
> - when requested at `/whatever`, respond with `200` -->

<!-- A service can be described as an async function receiving a request and returning a response or null.

On a real use case _requestToResponse_ needs to be splitted into smaller functions (services) to keep it maintainable. `@jsenv/server` provides an helper for this called _composeService_. It is an async function returning the first response produced by a list of async functions called in sequence. -->
```
