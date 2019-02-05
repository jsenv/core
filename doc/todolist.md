# Things to do

```javascript
import name from "./index.js"

if (name !== "createSignal") {
  throw new Error("name must be createSignal")
}

console.log("poc-dev-signal tests passed")
```

- [ ] Run `poc-dev-signal/index.test.js` on node with coverage and ensure coverage report is correct
- [ ] Run `poc-dev-signal/index.test.js` on chrome headless with coverage and ensure coverage report is correct
- [ ] Hot reloading work in node

* Run a command like `jsrun poc-dev-signal/index.test.js --watch --platform=node`.
* Terminal opens and `poc-dev-signal tests passed` must be logged once.
* Terminal stays open. (You can close it using ctrl+c).
* Change `poc-dev-signal/index.test.js` using `ctrl+s`
* Look terminal, `poc-dev-signal tests passed` must be logged twice.

- [ ] make hot reloading work in chrome

* Run a command like `jsrun poc-dev-signal/index.test.js --watch --platform=chrome`.
* Terminal opens
* Chrome opens
* Look chrome console, `poc-dev-signal tests passed` must be logged once.
* Look terminal, `poc-dev-signal tests passed` must be logged once.
* Terminal stays open. (You can close it using ctrl+c).
* Change `poc-dev-signal/index.test.js` using `ctrl+s`.
* Look chrome console `poc-dev-signal tests passed` must be logged twice.
* Look terminal, `poc-dev-signal tests passed` must be logged twice.

## Planned features

## Bundle

Description: Each System.import will do an http request. The idea is, somehow, to cache some of them.

Strategy: I will use this on concrete project to get a better overview of how it works. Then I'll create a list of solution to see how we could cache some http requests.
