# [side_effects_filesystem.test.mjs](../../side_effects_filesystem.test.mjs)

```js
writeFileSync(
  new URL("./out/toto/2_write_sync_deep.txt", import.meta.url),
  "2_write_sync_deep",
);
```

# 1/2 write file "./out/toto/2_write_sync_deep.txt"

```txt
2_write_sync_deep
```

# 2/2 return

```js
undefined
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
