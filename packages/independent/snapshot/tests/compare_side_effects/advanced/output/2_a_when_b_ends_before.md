```js
console.log("a_before_timeout_200");
await new Promise((resolve) => {
  setTimeout(resolve, 200);
});
console.log("a_after_timeout_200");
```

# 1/7 console.log

```console
a_before_timeout_200
```

# 2/7 return promise

# 3/7 console.log

```console
b_before_timeout_50
```

# 4/7 console.log

```console
b_after_timeout_50
```

# 5/7 write file "@jsenv/core/packages/independent/snapshot/tests/compare_side_effects/advanced/output/3_b_when_b_ends_before.md"

<details>
  <summary>details</summary>

```md
\`\`\`js
console\.log\("b\_before\_timeout\_50"\);
await new Promise\(\(resolve\) => \{
  setTimeout\(resolve, 50\);
\}\);
console\.log\("b\_after\_timeout\_50"\);
\`\`\`

\# 1/4 console\.log

\`\`\`console
b\_before\_timeout\_50
\`\`\`

\# 2/4 return promise

\# 3/4 console\.log

\`\`\`console
b\_after\_timeout\_50
\`\`\`

\# 4/4 resolve

\`\`\`js
undefined
\`\`\`

Generated by \[@jsenv/snapshot\]\(https://github/.com/jsenv/core/tree/main/packages/independent/snapshot\)
```
</details>

# 6/7 console.log

```console
a_after_timeout_200
```

# 7/7 resolve

```js
undefined
```

Generated by [@jsenv/snapshot](https://github.com/jsenv/core/tree/main/packages/independent/snapshot)