# [1_sw_type_module_no_bundling](../../service_worker_type_module_build.test.mjs#L36)

```js
run({
  runtimeCompat: { chrome: "80" },
  versioning: false, // to prevent importmap forcing fallback on js classic
  bundling: false,
})
```

# 1/2 write 5 files into "./build/"

see [./build/](./build/)

# 2/2 resolve

```js
{
  "inspectResponse": {
    "order": [],
    "resourcesFromJsenvBuild": {
      "/main.html": {},
      "/css/style.css": {
        "versionedUrl": null
      },
      "/js/a.js": {
        "versionedUrl": null
      },
      "/js/b.js": {
        "versionedUrl": null
      }
    }
  }
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
