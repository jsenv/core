# [0_basic](../../link_manifest_build.test.mjs#L5)

```js
build({
  sourceDirectoryUrl: import.meta.resolve("./client/"),
  buildDirectoryUrl: import.meta.resolve("./build/"),
  entryPoints: {
    "./src/main.html": {
      buildRelativeUrl: "./main.html",
      bundling: false,
      minification: false,
    },
  },
})
```

# 1/2 write 3 files into "./build/"

see [./build/](./build/)

# 2/2 resolve

```js
{}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
