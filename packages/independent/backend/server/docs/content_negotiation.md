# Content negotiation

You can use _pickContentType_ to respond with request prefered content type:

```js
import { startServer, pickContentType } from "@jsenv/server";

await startServer({
  routes: [
    // can be written like this
    {
      endpoint: "GET *",
      response: (request) => {
        const contentTypeNegotiated = pickContentType(request, [
          "application/json",
          "text/plain",
        ]);
        if (!contentTypeNegotiated) {
          return new Response(
            `Server cannot respond in the content-type you have requested. Server can only response in the following content types: "application/json", "text/plain"`,
            { status: 415 },
          );
        }
        if (responseContentType === "application/json") {
          return Response.json(
            { data: "Hello world" },
            {
              headers: { vary: "accept" },
            },
          );
        }
        return new Response("Hello world", {
          headers: { vary: "accept" },
        });
      },
    },
    // but better written like this:
    // - 415 Unsupported media type is handled for you
    // - request.contentTypeNegotiated gives you the prefered content-type for this request
    {
      endpoint: "GET *",
      availableContentTypes: ["application/json", "text/plain"],
      response: (request) => {
        if (request.contentTypeNegotiated === "application/json") {
          return Response.json({ data: "Hello world" });
        }
        return new Response("Hello world");
      },
    },
  ],
});
```

You can use _pickContentLanguage_ to respond with request prefered language:

```js
import { startServer, pickContentLanguage } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      availableLanguages: ["fr", "en"],
      response: ({ negotiatedLanguage }) => {
        if (negotiatedLanguage === "fr") {
          return new Response("Bonjour tout le monde !");
        }
        return new Response("Hello world!");
      },
    },
  ],
});
```

Finally, you can use _pickContentEncoding_ to respond with request prefered encoding:

```js
import { gzipSync } from "node:zlib";
import { startServer, pickContentEncoding } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET *",
      availableEncodings: ["gzip", "identity"],
      response: ({ negotiatedEncoding }) => {
        if (negotiatedEncoding === "gzip") {
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

```js
await startServer({
  routes: [
    {
      endpoint: "GET *",
      availableContentTypes: ["application/json", "text/plain"],
      availableLanguages: ["fr", "en"],
      response: ({ contentTypeNegotiated, languageNegotiated }) => {
        const message =
          languageNegotiated === "fr" ? "Bonjour tout le monde" : "Hello world";
        const headers = {
          "content-language": languageNegotiated,
        };
        if (contentTypeNegotiated === "application/json") {
          return Response.json({ data: message }, { headers });
        }
        return new Response(message, { headers });
      },
    },
  ],
});
```
