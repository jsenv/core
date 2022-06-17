# Abort [![npm package](https://img.shields.io/npm/v/@jsenv/abort.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/abort)

Help to write code accepting an [abortSignal](https://nodejs.org/api/globals.html#class-abortsignal).

- Designed to cleanup by default (removing event listeners, clearing timeouts, ...)
- Allow to safely bypass max listeners warning when needed
  - Code can do 20 abortable fetch requests in parallel without warnings
- Manage multiple abort signals
  - Compose abort signals from multiple sources
  - Code can do differents things depending on which signal aborted the operation

# Example

_fetch_demo.mjs_

```js
import { customFetch } from "./fetch_custom.mjs"

const abortController = new AbortController()
const signal = abortController.signal
process.on("warning", () => {
  abortController.abort()
})
await customFetch("http://example.com", { signal })
```

Code above pass an abort signal to `customFetch`.

Let's see how `"@jsenv/abort"` helps to manage the signal received.

_fetch_custom.mjs_

```js
import { Abort } from "@jsenv/abort"

export const customFetch = (
  url,
  { signal = new AbortController().signal } = {},
) => {
  // create an operation
  const fetchOperation = Abort.startOperation()

  // abort according to signal received in param
  fetchOperation.addAbortSignal(signal)

  // also abort on SIGINT
  const SIGINTAbortSource = fetchOperation.addAbortSource((abort) => {
    process.on("SIGINT", abort)
    return () => {
      process.removeListener("SIGINT", abort)
    }
  })

  // also abort after 5s
  const timeoutAbortSource = fetchOperation.timeout(5000)

  try {
    const response = await fetch(url, { signal: fetchOperation.signal })
    return response
  } catch (e) {
    if (Abort.isAbortError(e)) {
      if (SIGINTAbortSource.signal.aborted) {
        // aborted by SIGINT
      }
      if (timeoutAbortSource.signal.aborted) {
        // aborted by timeout
      }
      if (signal.aborted) {
        // aborted from outside
      }
    }
    throw e
  } finally {
    await fetchOperation.end()
  }
}
```
