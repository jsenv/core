# fetchUrl

`fetchUrl` is an async function requesting an url and returning a response object. It is a small wrapper on top of [node-fetch](https://github.com/node-fetch/node-fetch). It was created to provide a unified approach to request file and data urls.

```js
import { fetchUrl } from "@jsenv/fetch";

const responseForFile = await fetchUrl("file:///Users/you/index.html", {
  method: "GET",
  headers: {
    "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
  },
});

const responseForHttp = await fetchUrl("http://example.com/file.js", {
  method: "GET",
  headers: {
    "if-modified-since": "Wed, 21 Oct 2015 07:28:00 GMT",
  },
});
```
