# [0_basic](../../js_import_not_found_build.test.mjs#L20)

```js
run()
```

```console
FETCH_URL_CONTENT_ERROR: Failed to fetch url content
base/client/intermediate.js:2:7
1 | // eslint-disable-next-line import/no-unresolved
2 | import "./not_found.js";
          ^
no entry on filesystem
--- plugin name ---
"jsenv:file_url_fetching"
  at async run (base/js_import_not_found_build.test.mjs:6:3)
  at async base/js_import_not_found_build.test.mjs:19:1
```
---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>