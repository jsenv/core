# Content negotiation

You can use _pickContentType_ to respond with request prefered content type:

```js
import { startServer, pickContentType } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        const bestContentType = pickContentType(request, [
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
    },
  ],
})
```

You can use _pickContentLanguage_ to respond with request prefered language:

```js
import { startServer, pickContentLanguage } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        const bestLanguage = pickContentLanguage(request, ["fr", "en"])
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
    },
  ],
})
```

Finally, you can use _pickContentEncoding_ to respond with request prefered encoding:

```js
import { gzipSync } from "node:zlib"
import { startServer, pickContentEncoding } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: (request) => {
        const acceptedEncoding = pickContentEncoding(request, [
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
    },
  ],
})
```
