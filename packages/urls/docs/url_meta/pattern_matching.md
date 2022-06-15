# applyPatternMatching

_applyPatternMatching_ is a function returning a _matchResult_ indicating if and how a _pattern_ matches an _url_.

```js
import { URL_META } from "@jsenv/urls"

const matchResult = URL_META.applyPatternMatching({
  pattern: "file:///**/*",
  url: "file://Users/directory/file.js",
})
matchResult.matched // true
```

## pattern

_pattern_ parameter is a string looking like an url but where `*` and `**` can be used so that one specifier can match several url.

This parameter is **required**.

## url

_url_ parameter is a string representing a url.

This parameter is **required**.

## matchResult

_matchResult_ represents if and how a _pattern_ matches an _url_.

### Matching example

```js
import { URL_META } from "@jsenv/urls"

const fullMatch = URL_META.applyPatternMatching({
  pattern: "file:///**/*",
  url: "file:///Users/directory/file.js",
})
console.log(JSON.stringify(fullMatch, null, "  "))
```

```json
{
  "matched": true,
  "patternIndex": 12,
  "urlIndex": 31,
  "matchGroups": ["file.js"]
}
```

### Partial matching example

```js
import { applyPatternMatching } from "@jsenv/urlss"

const partialMatch = URL_META.applyPatternMatching({
  pattern: "file:///*.js",
  url: "file:///file.jsx",
})
console.log(JSON.stringify(partialMatch, null, "  "))
```

```json
{
  "matched": false,
  "patternIndex": 12,
  "urlIndex": 15,
  "matchGroups": ["file"]
}
```
