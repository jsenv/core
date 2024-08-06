# [0_basic](../../node_module_not_found_build.test.mjs#L6)

```js
build({
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  buildDirectoryUrl: new URL("./dist/", import.meta.url),
  entryPoints: { "./main.html": "main.html" },
})
```

```console
RESOLVE_URL_ERROR: Failed to resolve url reference
base/client/node_modules/foo/index.js:1:7
1 | import "not_found";
          ^
An error occured during specifier resolution
--- first reference in project ---
base/client/main.js:1:7
--- error message ---
Cannot find "not_found" imported from base/client/node_modules/foo/index.js
--- plugin name ---
"jsenv:node_esm_resolution"
  at async base/node_module_not_found_build.test.mjs:5:1
```
---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>