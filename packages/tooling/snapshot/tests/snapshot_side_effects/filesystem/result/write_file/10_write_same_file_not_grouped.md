# [side_effects_filesystem.test.mjs](../../side_effects_filesystem.test.mjs)

```js
writeFileSync(
  new URL("./out/10_write_same_file_not_grouped.txt", import.meta.url),
  "first",
);
console.log("hey");
writeFileSync(
  new URL("./out/10_write_same_file_not_grouped.txt", import.meta.url),
  "second",
);
```

# 1/4 write file "./out/10_write_same_file_not_grouped.txt"

```txt
first
```

# 2/4 console.log

```console
hey
```

# 3/4 write file "./out/10_write_same_file_not_grouped.txt"

```txt
second
```

# 4/4 return

```js
undefined
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
