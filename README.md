# Things to do

[] Create a new project called `poc-dev-signal`
[] `poc-dev-signal` must have this project and `@dmail/signal` as dependency
[] `poc-dev-signal/index.js` will must be something like

```javascript
import { createSignal } from "@dmail/signal"

console.log("Hello world")

export default createSignal.name
```

[] Run `poc-dev-signal/index.js` on node ensuring `'Hello world'` is logged and export default is correct
[] Run `poc-dev-signal/index.js` on chrome headless ensuring `'Hello world'` is logged and export default is correct
[] Run `poc-dev-signal/index.js` on chrome with ui ensuring `'Hello world'` is logged and export default is correct
[] Implement code instrumentaton for coverage in this project
[] Create `poc-dev-signal/index.test.js` with something like this inside

```javascript
import name from "./index.js"

if (name !== "createSignal") {
  throw new Error("name must be createSignal")
}

console.log("poc-dev-signal tests passed")
```

[] Run `poc-dev-signal/index.test.js` on node with coverage and ensure coverage report is correct
[] Run `poc-dev-signal/index.test.js` on chrome headless with coverage and ensure coverage report is correct
[] Hot reloading work in node

* Run a command like `jsrun poc-dev-signal/index.test.js --watch --platform=node`.
* Terminal opens and `poc-dev-signal tests passed` must be logged once.
* Terminal stays open. (You can close it using ctrl+c).
* Change `poc-dev-signal/index.test.js` using `ctrl+s`
* Look terminal, `poc-dev-signal tests passed` must be logged twice.
  [] make hot reloading work in chrome
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

## Dead code elimination

Description: Codebase contains dead code, thanks to static analysis of import/export we could remove dead code from files.

Strategy: We need to implement the bundle feature first. While developing this keep in mind the use case below:

**a.js**

```javascript
export const foo = "foo"

export const bar = "bar"
```

**index.html**

```html
<html>
  <head></head>
  <body>
    <script type="module">
      import { foo } from './a.js'

      alert(foo)
    </script>

    <button>Alert something</button>
    <script type="module">
      document.querySelector('button').onclick = () => {
        import('./a.js').then(({ bar, foo }) => {
          alert(`${foo}:${bar}`)
        })
      })
    </script>
  </body>
</html>
```

Be careful here:

* static `import { foo } from './a.js'` will have its `export const bar = 'bar'` removed by tree shaking.
* dynamic `import('./a.js')` need an other representation of `a.js` because it needs both `foo` and `bar` export.
