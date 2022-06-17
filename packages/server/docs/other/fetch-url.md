# Table of contents

- [fetchUrl example](#fetchUrl-example)
- [fetchUrl parameters](#fetchUrl-parameters)
  - [url](#url)
  - [ignoreHttpsError](#ignoreHttpsError)

# fetchUrl example

`fetchUrl` is an async function requesting an url and returning a response that can be used to consume the server response. It is a small wrapper on top of [node-fetch](https://github.com/node-fetch/node-fetch). It was created to be able to request file urls.

```js
import { fetchUrl } from "@jsenv/server"

const responseForFile = await fetchUrl("file:///Users/you/index.html", {
  method: "GET",
  headers: {
    "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
  },
})

const responseForHttp = await fetchUrl("http://example.com/file.js", {
  method: "GET",
  headers: {
    "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
  },
})
```

— source code at [src/fetchUrl.js](../src/fetchUrl.js).

# fetchUrl parameters

## url

TODO

## ignoreHttpsError

TODO
