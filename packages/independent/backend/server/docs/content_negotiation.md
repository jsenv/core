# Content negotiation

Content negotiation is a mechanism that allows the server to select the best representation of a resource when there are multiple options available. `@jsenv/server` provides tools to handle content type, language, version and encoding negotiation.

## Content type Negotiation

You can declare `availableContentTypes` and respond with client's preferred content type:

```js
import { startServer, pickContentType } from "@jsenv/server";

await startServer({
  routes: [
    // Manual negotiation approach
    {
      endpoint: "GET *",
      response: (request) => {
        const contentTypeNegotiated = pickContentType(request, [
          "application/json",
          "text/plain",
        ]);
        if (!contentTypeNegotiated) {
          return new Response(
            `Server cannot respond in the content type you have requested. Server can only respond in the following content types: "application/json", "text/plain"`,
            { status: 406 }, // 406 Not Acceptable is correct for this scenario
          );
        }
        if (contentTypeNegotiated === "application/json") {
          return Response.json(
            { data: "Hello world" },
            { headers: { vary: "accept" } },
          );
        }
        return new Response("Hello world", {
          headers: { vary: "accept" },
        });
      },
    },
    // Router-assisted negotiation (recommended)
    // - 406 Not Acceptable is handled automatically
    // - Vary header is set properly
    // - contentNegotiation gives you the negotiated values
    {
      endpoint: "GET *",
      availableContentTypes: ["application/json", "text/plain"],
      response: (request, { contentNegotiation }) => {
        if (contentNegotiation.contentType === "application/json") {
          return Response.json({ data: "Hello world" });
        }
        return new Response("Hello world");
      },
    },
  ],
});
```

## Language Negotiation

You can use `availableLanguages` to respond with the client's preferred language:

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      availableLanguages: ["fr", "en"],
      response: (request, { contentNegotiation }) => {
        if (contentNegotiation.language === "fr") {
          return new Response("Bonjour tout le monde !", {
            "content-language": "fr",
          });
        }
        return new Response("Hello world!", {
          "content-language": "en",
        });
      },
    },
  ],
});
```

## Versioning

You can use `availableVersions` to respond with the client's desired version:

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      availableVersions: ["1", "2"],
      response: (request, { contentNegotiation }) => {
        if (contentNegotiation.version === "1") {
          return new Response("v1");
        }
        return new Response("v2");
      },
    },
  ],
});
```

## Encoding Negotiation

You can use `availableEncodings` to compress responses based on client preferences:

```js
import { gzipSync } from "node:zlib";
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      availableEncodings: ["gzip", "identity"],
      response: (request, { contentNegotiation }) => {
        if (contentNegotiation.encoding === "gzip") {
          return new Response(gzipSync(Buffer.from(`Hello world!`)), {
            headers: {
              "content-encoding": "gzip",
            },
          });
        }
        return new Response("Hello world!");
      },
    },
  ],
});
```

## Multiple negotiations

You can combine content type, language, and encoding negotiations in a single route:

```js
await startServer({
  routes: [
    {
      endpoint: "GET *",
      availableContentTypes: ["application/json", "text/plain"],
      availableLanguages: ["fr", "en"],
      response: (request, { contentNegotiation }) => {
        const message =
          contentNegotiation.language === "fr"
            ? "Bonjour tout le monde"
            : "Hello world";
        const headers = {
          "content-language": contentNegotiation.language,
        };
        if (contentNegotiation.contentType === "application/json") {
          return Response.json({ data: message }, { headers });
        }
        return new Response(message, { headers });
      },
    },
  ],
});
```

## Error Handling

The router automatically handles these errors:

- **406 Not Acceptable**: When the server cannot provide a response matching the client's Accept headers

When using router-assisted negotiation, proper Vary headers are automatically set to ensure correct caching behavior.
