# [side_effects_filesystem.test.mjs](../../side_effects_filesystem.test.mjs)

```js
writeFileSync(
  new URL(
    "./out/11_write_same_file_not_grouped_and_out.txt",
    import.meta.url,
  ),
  "first",
);
console.log("hey");
writeFileSync(
  new URL(
    "./out/11_write_same_file_not_grouped_and_out.txt",
    import.meta.url,
  ),
  "second",
);
```

# 1/4 write file "./out/11_write_same_file_not_grouped_and_out.txt"

see [./11_write_same_file_not_grouped_and_out/out/11_write_same_file_not_grouped_and_out.txt](./11_write_same_file_not_grouped_and_out/out/11_write_same_file_not_grouped_and_out.txt)

# 2/4 console.log

```console
hey
```

# 3/4 write file "./out/11_write_same_file_not_grouped_and_out.txt"

see [./11_write_same_file_not_grouped_and_out/out/11_write_same_file_not_grouped_and_out_1.txt](./11_write_same_file_not_grouped_and_out/out/11_write_same_file_not_grouped_and_out_1.txt)

# 4/4 return

```js
undefined
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
