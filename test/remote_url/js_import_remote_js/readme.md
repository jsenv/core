Here we want to test source code can import from an http url

```js
import { value } from "https://localhost:9999/file.js"
```

It can be executed in a browser a long as the code compiled do not use SystemJS.

TODO:

- make it work with systemJS too
  It means https://localhost:9999/file.js should somehow actually request compile server: https://localhost:3456?source_url=encodeURIComponent('https://localhost:9999/file.js')

  what if the dev server url changes? for now let's ignore

  Or we could assume external url are written with import/export and use
  a dynamic import to load them in systemjs (this assumption would break on old browsers + not sure it works)

- test during build
