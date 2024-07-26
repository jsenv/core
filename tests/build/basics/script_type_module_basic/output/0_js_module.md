1. console.info
```console

build "./main.html"
```

2. process.stdout
```console
⠋ generate source graph

```

3. return promise

4. process.stdout
```console
✔ generate source graph (done in <X> second)

```

5. process.stdout
```console
⠋ generate build graph

```

6. process.stdout
```console
✔ generate build graph (done in <X> second)

```

7. process.stdout
```console
⠋ write files in build directory

```

8. write file "./build/js/main.js" (see ./0_js_module/build/js/main.js)

9. write file "./build/main.html" (see ./0_js_module/build/main.html)

10. process.stdout
```console
✔ write files in build directory (done in <X> second)

```

11. console.info
```console
--- build files ---  
- html : 1 (175 B / 91 %)
- js   : 1 (17 B / 9 %)
- total: 2 (192 B / 100 %)
--------------------
```

12. resolve
```js
{
  "buildInlineContents": {},
  "buildManifest": {}
}
```