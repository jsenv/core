# Content negotiation

You can use _pickContentType_ to respond with request prefered content type:

```js
import { startServer, pickContentType } from "@jsenv/server";

await startServer({
  routes: [
    // can be written like this
    {
      url: "*",
      method: "GET",
      responseAvailableContentTypes: ["application/json", "text/plain"],
      response: (request) => {
        const contentTypeNegotiated = pickContentType(request, [
          "application/json",
          "text/plain",
        ]);
        if (!contentTypeNegotiated) {
          return Response.text(
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
        return Response.text("Hello world", {
          headers: { vary: "accept" },
        });
      },
    },
    // but better written like this:
    // - 415 Unsupported media type is handled for you
    // - request.contentTypeNegotiated gives you the prefered content-type for this request
    {
      url: "*",
      method: "GET",
      responseAvailableContentTypes: ["application/json", "text/plain"],
      response: (request) => {
        if (request.contentTypeNegotiated === "application/json") {
          return Response.json({ data: "Hello world" });
        }
        return Response.text("Hello world");
      },
    },
  ],
});
```

You can use _pickContentLanguage_ to respond with request prefered language:

```js
import { startServer, pickContentLanguage } from "@jsenv/server";

await startServer({
  services: [
    {
      handleRequest: {
        "GET *": (request) => {
          const bestLanguage = pickContentLanguage(request, ["fr", "en"]);
          const responseLanguage = bestLanguage || "en";
          const availableLanguages = {
            fr: () => {
              const body = "Bonjour tout le monde !";
              return {
                headers: {
                  "content-type": "text/plain",
                  "content-length": Buffer.byteLength(body),
                  "content-language": "fr",
                },
                body,
              };
            },
            en: () => {
              const body = `Hello world!`;
              return {
                headers: {
                  "content-type": "text/plain",
                  "content-length": Buffer.byteLength(body),
                  "content-language": "en",
                },
                body,
              };
            },
          };
          const responseInNegotiatedLanguage =
            availableLanguages[responseLanguage]();
          return responseInNegotiatedLanguage;
        },
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
  services: [
    {
      handleRequest: {
        "GET *": (request) => {
          const acceptedEncoding = pickContentEncoding(request, [
            "gzip",
            "identity",
          ]);
          const responseEncoding = acceptedEncoding || "identity";
          const availableEncodings = {
            gzip: () => {
              const body = gzipSync(Buffer.from(`Hello world!`));
              return {
                headers: {
                  "content-type": "text/plain",
                  "content-encoding": "gzip",
                },
                body,
              };
            },
            identity: () => {
              const body = "Hello world!";
              return {
                headers: {
                  "content-type": "text/plain",
                  "content-length": Buffer.byteLength(body),
                },
                body,
              };
            },
          };
          const responseInNegotiatedEncoding =
            availableEncodings[responseEncoding]();
          return responseInNegotiatedEncoding;
        },
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
      url: "/",
      method: "GET",
      responseAvailableContentTypes: ["application/json", "text/plain"],
      responseAvailableLanguagues: ["fr", "en"],
      response: ({ contentTypeNegotiated, languageNegotiated }) => {
        const message =
          languageNegotiated === "fr" ? "Bonjour tout le monde" : "Hello world";
        const headers = {
          "content-language": languageNegotiated,
        };
        if (contentTypeNegotiated === "application/json") {
          return Response.json({ data: message }, { headers });
        }
        return Response.text(message, { headers });
      },
    },
  ],
});
```
