# [2_js_module_fallback](../../import_meta_resolve_build.test.mjs#L35)

```js
run({
  runtimeCompat: { chrome: "60" },
})
```

# 1/2 write 3 files into "./build/"

see [./build/](./build/)

# 2/2 resolve

```js
{
  "importMetaResolveReturnValue": "window.origin/js/foo.js",
  "__TEST__": "window.origin/js/foo.js"
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>
