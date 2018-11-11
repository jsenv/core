# generator

Observable and Generator mix with the simplest possible api.

# Example

```js
import { subscribe, filter } from "@dmail/generator"

const documentClick = ({ next }) => {
  document.addEventListener("click", next)
  return () => document.removeEventListener("click", next)
}

const bodyClick = filter(documentClick, (e) => e.target === document.body)

subscribe(bodyClick, {
  next: (e) => {
    console.log(`clicked on body at ${e.pageX}:${e.pageY}`)
  },
})
```

# API

## subscribe(generatorFunction, { next, error, done } = {})

## share(generatorFunction)

Returns a generatorFunction that will reuse same generator when called multiple times

## map(generatorFunction, callback)

## filter(generatorFunction, callback)
