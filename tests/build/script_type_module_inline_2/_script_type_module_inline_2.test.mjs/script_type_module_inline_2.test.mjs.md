# script_type_module_inline_2

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a> executing <a href="../script_type_module_inline_2.test.mjs">../script_type_module_inline_2.test.mjs</a>
</sub>

## 0_js_module

```js
run({
  runtimeCompat: { chrome: "89" },
})
```

### 1/4 logs

![img](0_js_module/log_group.svg)

<details>
  <summary>see without style</summary>

```console

build "./main.html"
⠋ generate source graph
✔ generate source graph (done in <X> second)
⠋ generate build graph
✔ generate build graph (done in <X> second)
⠋ resync resource hints
✔ resync resource hints (done in <X> second)
⠋ write files in build directory

```

</details>


### 2/4 write 3 files into "./build/"

see [./0_js_module/build/](./0_js_module/build/)

### 3/4 logs

![img](0_js_module/log_group_1.svg)

<details>
  <summary>see without style</summary>

```console
✔ write files in build directory (done in <X> second)
--- build files ---  
- html : 1 (969 B / 86 %)
- js   : 2 (154 B / 14 %)
- total: 3 (1.1 kB / 100 %)
--------------------
```

</details>


### 4/4 resolve

```js
{}
```

## 1_js_module_fallback

```js
run({
  runtimeCompat: { chrome: "64" },
})
```

### 1/4 logs

![img](1_js_module_fallback/log_group.svg)

<details>
  <summary>see without style</summary>

```console

build "./main.html"
⠋ generate source graph
✔ generate source graph (done in <X> second)
⠋ generate build graph
✔ generate build graph (done in <X> second)
⠋ resync resource hints
✔ resync resource hints (done in <X> second)
⠋ write files in build directory

```

</details>


### 2/4 write 3 files into "./build/"

see [./1_js_module_fallback/build/](./1_js_module_fallback/build/)

### 3/4 logs

![img](1_js_module_fallback/log_group_1.svg)

<details>
  <summary>see without style</summary>

```console
✔ write files in build directory (done in <X> second)
--- build files ---  
- html : 1 (18.2 kB / 97 %)
- js   : 2 (550 B / 3 %)
- total: 3 (18.7 kB / 100 %)
--------------------
```

</details>


### 4/4 resolve

```js
{}
```

## 2_js_module_fallback_and_sourcemap_as_file

```js
run({
  runtimeCompat: { chrome: "60" },
  sourcemaps: "file",
})
```

### 1/4 logs

![img](2_js_module_fallback_and_sourcemap_as_file/log_group.svg)

<details>
  <summary>see without style</summary>

```console

build "./main.html"
⠋ generate source graph
✔ generate source graph (done in <X> second)
⠋ generate build graph
✔ generate build graph (done in <X> second)
⠋ resync resource hints
✔ resync resource hints (done in <X> second)
⠋ write files in build directory

```

</details>


### 2/4 write 8 files into "./build/"

see [./2_js_module_fallback_and_sourcemap_as_file/build/](./2_js_module_fallback_and_sourcemap_as_file/build/)

### 3/4 logs

![img](2_js_module_fallback_and_sourcemap_as_file/log_group_1.svg)

<details>
  <summary>see without style</summary>

```console
✔ write files in build directory (done in <X> second)
--- build files ---  
- html : 1 (18.6 kB / 97 %)
- js   : 2 (636 B / 3 %)
- total: 3 (19.2 kB / 100 %)
--------------------
```

</details>


### 4/4 resolve

```js
{}
```