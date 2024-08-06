# [0_basic](../../coverage_node_merge.test.mjs#L42)

```js
await run({
  testPlan: {
    "./main.js": {
      node: {
        runtime: nodeWorkerThread({
          env: { FOO: true },
        }),
      },
      node2: {
        runtime: nodeWorkerThread(),
      },
    },
  },
});
```

# 1/2 write file "./file.js.png"

see [./file.js.png](./file.js.png)

# 2/2 resolve

```js
undefined
```
---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a>
</sub>