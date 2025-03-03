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

## response functions

A _response_ function is responsible for generating a response from a request.

- It is expected to return a _response_, `null` or `undefined`
- It can be an `async`
- Returning `null` or `undefined` indicates the route doesn't handle the request

When no route produces a response for the request, the server responds with _404 Not Found_.

## request object

The request object represents an HTTP request and is passed as the first argument to each response function.

**Request object example**:

<!-- prettier-ignore -->
```js
const request = {
  signal,                                          // AbortSignal to detect cancellation
  http2: false,                                    // Whether request uses HTTP/2
  url: "http://127.0.0.1:8080/index.html?param=1", // Full URL
  origin: "http://127.0.0.1:8080",                 // Origin part
  pathname: "/index.html",                         // Path portion
  searchParams: new URLSearchParams("?param=1"),   // Query parameters
  resource: "/index.html?param=1",                 // Resource identifier
  method: "GET",                                   // HTTP method
  headers: { accept: "text/html" },                // Request headers
  body,                                            // Request body
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
        return new Response(`Current page: ${page}`);
      },
    },
    // OR
    {
      endpoint: "GET /?page=:page",
      response: (request) => {
        const { page } = request.params;
        return new Response(`Current page: ${page}`);
      },
    },
  ],
});
```

Read more at [MDN URLSearchParams documentation](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams).

### Reading request body

Pass an `acceptedContentTypes` array to the route to specify which content types your handler can process. If the request uses a content-type you don't support, a response with status 415 (Unsupported Media Type) will be sent automatically.

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

        if (requestContentType === "text/plain") {
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

## response formats

Responses can be created in two different ways:

1. Using the standard Response constructor

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      response: () => {
        return new Response("Hello world", {
          status: 200,
          headers: { "content-type": "text/plain" },
        });
      },
    },
  ],
});
```

2. Using a response object

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      response: () => {
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

### Response body types

The response body can be created from various sources:

**String body**

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      response: () => {
        return {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: "hello world",
        };
      },
    },
  ],
});
```

**Buffer body**

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      response: () => {
        return {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: Buffer.from("Hello world"),
        };
      },
    },
  ],
});
```

**Stream body**

```js
import { createReadStream } from "node:fs";
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      response: () => {
        return {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: createReadStream("/User/you/folder/file.txt"),
        };
      },
    },
  ],
});
```

**Observable body**

```js
import { startServer, createObservableBody } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /",
      response: () => {
        return {
          status: 200,
          headers: { "content-type": "text/plain" },
          body: createObservableBody(({ next, complete }) => {
            next("hello world");
            complete();
          }),
        };
      },
    },
  ],
});
```

## Error handling

When an exception occurs in a response handler, the server automatically returns a 500 Internal Server Error. For custom error handling, use try/catch blocks:

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /api/data",
      response: async (request) => {
        try {
          const data = await fetchExternalData();
          return Response.json(data);
        } catch (error) {
          console.error("Failed to fetch data:", error);
          return Response.json(
            { error: "Could not retrieve data" },
            { status: 500 },
          );
        }
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
