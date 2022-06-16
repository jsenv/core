# urlChildMayMatch

_urlChildMayMatch_ is a function designed to ignore directory content that would never have specific metas.

```js
import { URL_META } from "@jsenv/url-meta"

const associations = {
  color: {
    "file:///**/*": "blue",
    "file:///**/node_modules/": "green",
  },
}

const firstUrlCanHaveFilesWithColorBlue = URL_META.urlChildMayMatch({
  url: "file:///src/",
  associations,
  predicate: ({ color }) => color === "blue",
})
firstUrlCanHaveFilesWithColorBlue // true

const secondUrlCanHaveFileWithColorBlue = URL_META.urlChildMayMatch({
  url: "file:///node_modules/src/",
  associations,
  predicate: ({ color }) => color === "blue",
})
secondUrlCanHaveFileWithColorBlue // false
```
