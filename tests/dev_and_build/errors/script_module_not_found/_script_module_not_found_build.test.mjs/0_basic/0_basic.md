# [0_basic](../../script_module_not_found_build.test.mjs#L20)

```js
run()
```

```console
FETCH_URL_CONTENT_ERROR: Failed to fetch url content
base/client/main.html:10:27
 7 |   </head>
 8 | 
 9 |   <body>
10 |     <script type="module" src="./404.js"></script>
                               ^
no entry on filesystem
--- plugin name ---
"jsenv:file_url_fetching"
  at createFailedToFetchUrlContentError (@jsenv/core/src/kitchen/errors.js:63:24)
  at createFetchUrlContentError (@jsenv/core/src/kitchen/errors.js:104:14)
  at Object.fetchUrlContent (@jsenv/core/src/kitchen/kitchen.js:402:13)
  at async @jsenv/core/src/kitchen/kitchen.js:475:11
  at async Object.startCollecting (@jsenv/core/src/kitchen/url_graph/references.js:30:7)
  at async @jsenv/core/src/kitchen/kitchen.js:473:9
  at async Object.cook (@jsenv/core/src/kitchen/kitchen.js:658:5)
  at async cookSelfThenDependencies (@jsenv/core/src/kitchen/kitchen.js:548:7)
  at async Promise.all (index 0)
  at async startCookingDependencies (@jsenv/core/src/kitchen/kitchen.js:582:7)
```
---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>