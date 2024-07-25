1. console.info
```console

build "./main.html"
```

2. process.stdout
```console
⠋ generate source graph

```

3. return promise

4. write file ".jsenv/craft/main.html" (see ./0_js_module/.jsenv/craft/main.html)

5. write file ".jsenv/craft/main.js" (see ./0_js_module/.jsenv/craft/main.js)

6. process.stdout
```console
✔ generate source graph (done in 0.02 second)

```

7. process.stdout
```console
⠋ generate build graph

```

8. write file ".jsenv/shape/main.html" (see ./0_js_module/.jsenv/shape/main.html)

9. write file ".jsenv/shape/main.js" (see ./0_js_module/.jsenv/shape/main.js)

10. process.stdout
```console
✔ generate build graph (done in 0.005 second)

```

11. write file ".jsenv/shape/main.html" (see ./0_js_module/.jsenv/shape/main.html)

12. process.stdout
```console
⠋ write files in build directory

```

13. write directory "build"

14. write directory "build/js/"

15. write file "build/js/main.js" (see ./0_js_module/build/js/main.js)

16. write file "build/main.html" (see ./0_js_module/build/main.html)

17. process.stdout
```console
✔ write files in build directory (done in 0.002 second)

```

18. console.info
```console
--- build files ---  
- html : 1 (175 B / 91 %)
- js   : 1 (17 B / 9 %)
- total: 2 (192 B / 100 %)
--------------------
```

19. resolve
```js
{
  "buildFileContents": {
    "js/main.js": "console.log(42);\n",
    "main.html": "<!DOCTYPE html>\n<html>\n  <head>\n    <title>Title</title>\n    <meta charset=\"utf-8\">\n  </head>\n\n  <body>\n    <script type=\"module\" src=\"/js/main.js\"></script>\n  </body>\n</html>"
  },
  "buildInlineContents": {},
  "buildManifest": {}
}
```