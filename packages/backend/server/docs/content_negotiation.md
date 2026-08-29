# Content negotiation

A route declares what it can produce; the router picks what the request prefers, sets the `vary` header and answers 406 when nothing fits.

## Media type

```js
import { startServer } from "@jsenv/server";

await startServer({
  routes: [
    {
      endpoint: "GET /hello",
      availableMediaTypes: ["application/json", "text/plain"],
      fetch: (request, { contentNegotiation }) => {
        if (contentNegotiation.mediaType === "application/json") {
          return Response.json({ data: "Hello world" });
        }
        return new Response("Hello world");
      },
    },
  ],
});
```

`Accept: text/*` gets text, `Accept: application/json` gets json, `Accept: image/png` gets 406. Without an `accept` header the first media type wins. The media type of a route whose endpoint has an extension (`GET /data.json`) is inferred.

The same can be done by hand with `pickContentType(request, availableMediaTypes)`, which returns the media type to use or `null` — then the 406 and the `vary` header are up to the route.

## Language, version, encoding

`availableLanguages` (`accept-language`), `availableVersions` (`accept-version`) and `availableEncodings` (`accept-encoding`) work the same way, and combine:

```js
{
  endpoint: "GET /hello",
  availableMediaTypes: ["application/json", "text/plain"],
  availableLanguages: ["fr", "en"],
  fetch: (request, { contentNegotiation }) => {
    const message =
      contentNegotiation.language === "fr"
        ? "Bonjour tout le monde"
        : "Hello world";
    const headers = { "content-language": contentNegotiation.language };
    if (contentNegotiation.mediaType === "application/json") {
      return Response.json({ data: message }, { headers });
    }
    return new Response(message, { headers });
  },
}
```

```js
import { gzipSync } from "node:zlib";

{
  endpoint: "GET /hello",
  availableEncodings: ["gzip", "identity"],
  fetch: (request, { contentNegotiation }) => {
    if (contentNegotiation.encoding === "gzip") {
      return new Response(gzipSync(Buffer.from("Hello world!")), {
        headers: { "content-encoding": "gzip" },
      });
    }
    return new Response("Hello world!");
  },
}
```

A version can also be a function, `availableVersions: [(version) => version.startsWith("1.")]`.

## When several negotiations fail

The 406 explains each failure (media types, languages, versions, encodings) and lists what is available in `available-media-types`, `available-languages`, `available-versions`, `available-encodings` response headers.

## Checking the response

The router warns (at the request log level) when the response `content-type`, `content-language`, `content-version` or `content-encoding` is not among what the route declared. `serverPluginResponseAcceptanceCheck` goes further and warns when a response does not honor what the request accepted, whatever the route declared.
