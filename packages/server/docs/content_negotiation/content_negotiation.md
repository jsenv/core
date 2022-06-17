# Content negotiation

You can use _negotiateContentType_ to respond with request prefered content type:

```js
import { negotiateContentType, startServer } from "@jsenv/server"

await startServer({
  requestToResponse: (request) => {
    const bestContentType = negotiateContentType(request, [
      "application/json",
      "text/plain",
    ])
    const responseContentType = bestContentType || "text/plain"

    return {
      "application/json": () => {
        const body = JSON.stringify({
          data: "Hello world",
        })
        return {
          headers: {
            "content-type": "application/json",
            "content-length": Buffer.byteLength(body),
          },
          body,
        }
      },
      "text/plain": () => {
        const body = `Hello world`
        return {
          headers: {
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(body),
          },
          body,
        }
      },
    }[responseContentType]
  },
})
```

You can use _negotiateContentLanguage_ to respond with request prefered language:

```js
import { negotiateContentLanguage, startServer } from "@jsenv/server"

await startServer({
  requestToResponse: (request) => {
    const bestLanguage = negotiateContentLanguage(request, ["fr", "en"])
    const responseLanguage = bestLanguage || "en"

    return {
      fr: () => {
        const body = "Bonjour tout le monde !"
        return {
          headers: {
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(body),
            "content-language": "fr",
          },
          body,
        }
      },
      en: () => {
        const body = `Hello world!`
        return {
          headers: {
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(body),
            "content-language": "en",
          },
          body,
        }
      },
    }[responseLanguage]
  },
})
```

Finally, you can use _negotiateContentEncoding_ to respond with request prefered encoding:

```js
import { gzipSync } from "node:zlib"
import { negotiateContentEncoding, startServer } from "@jsenv/server"

await startServer({
  requestToResponse: (request) => {
    const acceptedEncoding = negotiateContentEncoding(request, [
      "gzip",
      "identity",
    ])
    const responseEncoding = acceptedEncoding || "identity"

    return {
      gzip: () => {
        const body = gzipSync(Buffer.from(`Hello world!`))
        return {
          headers: {
            "content-type": "text/plain",
            "content-encoding": "gzip",
          },
          body,
        }
      },
      identity: () => {
        const body = "Hello world!"
        return {
          headers: {
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(body),
          },
          body,
        }
      },
    }[responseEncoding]
  },
})
```
