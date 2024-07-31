# import_type_css_build.md

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/independent/snapshot">@jsenv/snapshot</a> executing <a href="../import_type_css_build.test.mjs">../import_type_css_build.test.mjs</a>
</sub>

## 0_js_module

```js
build({
  ...testParams,
  runtimeCompat: { chrome: "89" },
  minification: false,
})
```

### 1/4 logs

![img](0_js_module/0_js_module_log_group.svg)

### 2/4 write 3 files into "./build/"

see [./0_js_module/build/](./0_js_module/build/)

### 3/4 logs

![img](0_js_module/0_js_module_log_group_1.svg)

### 4/4 resolve

```js
{}
```

## 1_js_module_fallback_css_minified

```js
build({
  ...testParams,
  runtimeCompat: { chrome: "88" },
  minification: {
    js_module: false,
    js_classic: false,
    css: true,
  },
})
```

### 1/4 logs

![img](1_js_module_fallback_css_minified/1_js_module_fallback_css_minified_log_group.svg)

### 2/4 write 3 files into "./build/"

see [./1_js_module_fallback_css_minified/build/](./1_js_module_fallback_css_minified/build/)

### 3/4 logs

![img](1_js_module_fallback_css_minified/1_js_module_fallback_css_minified_log_group_1.svg)

### 4/4 resolve

```js
{}
```

## 2_js_module_fallback

```js
build({
  ...testParams,
  runtimeCompat: { chrome: "60" },
  minification: false,
})
```

### 1/4 logs

![img](2_js_module_fallback/2_js_module_fallback_log_group.svg)

### 2/4 write 3 files into "./build/"

see [./2_js_module_fallback/build/](./2_js_module_fallback/build/)

### 3/4 logs

![img](2_js_module_fallback/2_js_module_fallback_log_group_1.svg)

### 4/4 resolve

```js
{}
```

## 3_js_module_fallback_no_bundling

```js
build({
  ...testParams,
  runtimeCompat: { chrome: "64" },
})
```

### 1/4 logs

![img](3_js_module_fallback_no_bundling/3_js_module_fallback_no_bundling_log_group.svg)

### 2/4 write 3 files into "./build/"

see [./3_js_module_fallback_no_bundling/build/](./3_js_module_fallback_no_bundling/build/)

### 3/4 logs

![img](3_js_module_fallback_no_bundling/3_js_module_fallback_no_bundling_log_group_1.svg)

### 4/4 resolve

```js
{}
```