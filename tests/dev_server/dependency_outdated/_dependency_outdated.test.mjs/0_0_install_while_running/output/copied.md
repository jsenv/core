[jsenv] A dependency is outdated
Page: http://127.0.0.1/main.html
```
foo
  package.json declares  1.0.1
  node_modules holds     1.0.0
```
The page is running with what is installed in node_modules, which is not what package.json asks for. It may work, but it is not the code the project expects.
Run npm install to fix it. If an install is already running, there is nothing to do but wait.
As soon as node_modules matches package.json, this page reloads by itself.