# import_meta_resolve_node

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a> executing <a href="../import_meta_resolve_node.test.mjs">../import_meta_resolve_node.test.mjs</a>
</sub>

## node_0_import_meta_resolve

```js
build({
  ...testParams,
  runtimeCompat: { node: "20" },
})
```

### 1/4 logs

![img](import_meta_resolve_node/node_0_import_meta_resolve/log_group.svg)

<details>
  <summary>see without style</summary>

```console

build "./index.js"
⠋ generate source graph
✔ generate source graph (done in <X> second)
⠋ bundle "js_module"
✔ bundle "js_module" (done in <X> second)
⠋ generate build graph
✔ generate build graph (done in <X> second)
⠋ write files in build directory

```

</details>


### 2/4 write 3 files into "./build/"

see [./import_meta_resolve_node/node_0_import_meta_resolve/build/](./import_meta_resolve_node/node_0_import_meta_resolve/build/)

### 3/4 logs

![img](import_meta_resolve_node/node_0_import_meta_resolve/log_group_1.svg)

<details>
  <summary>see without style</summary>

```console
✔ write files in build directory (done in <X> second)
--- build files ---  
- js   : 2 (322 B / 69 %)
- json : 1 (142 B / 31 %)
- total: 3 (464 B / 100 %)
--------------------
```

</details>


### 4/4 resolve

```js
{}
```

## node_1_import_meta_resolve_fallback

```js
build({
  ...testParams,
  runtimeCompat: { node: "19" },
})
```

### 1/4 logs

![img](import_meta_resolve_node/node_1_import_meta_resolve_fallback/log_group.svg)

<details>
  <summary>see without style</summary>

```console

build "./index.js"
⠋ generate source graph
✔ generate source graph (done in <X> second)
⠋ bundle "js_module"
✔ bundle "js_module" (done in <X> second)
⠋ generate build graph
✔ generate build graph (done in <X> second)
⠋ write files in build directory

```

</details>


### 2/4 write 3 files into "./build/"

see [./import_meta_resolve_node/node_1_import_meta_resolve_fallback/build/](./import_meta_resolve_node/node_1_import_meta_resolve_fallback/build/)

### 3/4 logs

![img](import_meta_resolve_node/node_1_import_meta_resolve_fallback/log_group_1.svg)

<details>
  <summary>see without style</summary>

```console
✔ write files in build directory (done in <X> second)
--- build files ---  
- js   : 2 (362 B / 72 %)
- json : 1 (142 B / 28 %)
- total: 3 (504 B / 100 %)
--------------------
```

</details>


### 4/4 resolve

```js
{}
```