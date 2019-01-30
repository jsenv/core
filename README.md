# dev-server

todo list

- follow up https://github.com/systemjs/systemjs/issues/1898
- implement mirrorConsole and captureCOnsole in launchNode
- implement mirrorConsole and captureConsole in launchChromium
- during executionPlanToCoverageMap implement and test log output
  that should look like that

```
✔ src/index.test.js
----------- console ----------
------------------------------
platform: "node"
status: "passed"

✔ src/file.test.js
----------- console ---------
Hello world
-----------------------------
platform: "chromium"
status: "passed"

☓ src/file.test.js
----------- console ---------
Error: cannot read property foo of undefined.
-----------------------------
platform: "node"
status: "errored"

☓ src/bar.test.js
----------- console ---------
log a
log b
-----------------------------
platform: "node"
status: "timedout"
statusText: "execution takes more than 5000ms to complete"

☓ src/foo.test.js
----------- console ---------
foo
-----------------------------
platform: "node"
status: "disconnected"
statusText: "platform disconnected before execution completed"

------ execution summary ---------
10 file execution launched
- 5 completed
- 2 errored
- 3 timedout
- 1 disconnected
----------------------------------
```

- Avoid node_modules in coverageMap
- an api to bundle js into dist

Nice to have

- we should still try to collect coverageMap if file execution throw
  (this way we would have a partial coverage until error was thrown)
