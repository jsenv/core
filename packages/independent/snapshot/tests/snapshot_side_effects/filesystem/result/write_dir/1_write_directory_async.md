# [side_effects_filesystem.test.mjs](../../side_effects_filesystem.test.mjs)

```js
await writeDirectory(new URL("./out/dir_async/", import.meta.url));
return existsSync(new URL("./out/dir_async/", import.meta.url));
```

# 1/2 write directory "./out/dir_async/"

# 2/2 resolve

```js
true
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>