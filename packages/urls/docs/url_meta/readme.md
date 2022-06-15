# url meta

Associate value to urls using pattern matching.

```js
import { URL_META } from "@jsenv/urls"

// conditionally associates url and values
const associations = {
  color: {
    "file:///*": "black",
    "file:///*.js": "red",
  },
}
const getUrlColor = (url) => {
  return URL_META.applyAssociations({ url, associations }).color
}
console.log(`file.json color is ${getUrlColor("file:///file.json")}`)
console.log(`file.js color is ${getUrlColor("file:///file.js")}`)
```

_Code above logs_

```console
file.json color is black
file.js color is red
```

# Common pattern example

| pattern            | Description                          |
| ------------------ | ------------------------------------ |
| `**/`              | Everything                           |
| `*/**/`            | Inside a directory                   |
| `**/.*/`           | Inside directory starting with a dot |
| `**/node_modules/` | Inside any `node_modules` directory  |
| `node_modules/`    | Inside root `node_modules` directory |
| `**/*.map`         | Ending with `.map`                   |
| `**/*.test.*`      | Contains `.test.`                    |
| `*`                | Inside the root directory only       |
| `*/*`              | Inside a directory of depth 1        |

Read more at [./pattern_matching.md](./pattern_matching.md)

# associations

_associations_ below translates into: "files are visible except thoose in .git/ directory"

```js
const associations = {
  visible: {
    "**/*/": true,
    "**/.git/": false,
  },
}
```

_associations_ allows to group patterns per property which are easy to read and compose.
All keys in _associations_ must be absolute urls, this can be done with [resolveAssociations](#resolveAssociations).

# resolveAssociations

_resolveAssociations_ is a function resolving _associations_ keys that may contain relative urls against an _url_.

```js
import { resolveAssociations } from "@jsenv/urls"

const associations = resolveAssociations(
  {
    visible: {
      "**/*/": true,
      "**/.git/": false,
    },
  },
  "file:///Users/directory/",
)
console.log(JSON.stringify(associations, null, "  "))
```

```json
{
  "visible": {
    "file:///Users/directory/**/*/": true,
    "file:///Users/directory/**/.git/": false
  }
}
```
