# Error handling

Errors are handled by the first service returning something in a "handleError" function.

```js
import { startServer } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: () => {
        throw new Error("toto")
      },
      handleError: (error, { request }) => {
        const body = `An error occured: ${error.message}`
        return {
          status: 500,
          headers: {
            "content-type": "text/plain",
            "content-length": Buffer.byteLength(body),
          },
          body,
        }
      },
    },
  ],
})
```

## handleError

_handleError_ is a function responsible to generate a response from an error.

- It is optional
- It receives the error in argument
- It is expected to return a _response_, `null` or `undefined`
- It can be an async function

When there is no service handling the error it is thrown leading to process exiting with 1.

### jsenvServiceErrorHandler

_jsenvServiceErrorHandler_ is a generic error handler. It can be used to catch errors and display a generic message.

```js
import { startServer, jsenvServiceErrorHandler } from "@jsenv/server"

await startServer({
  services: [
    {
      handleRequest: () => {
        throw new Error("toto")
      },
    },
    jsenvServiceErrorHandler(),
  ],
})
```

![screenshot of internal error page](./screenshots/500.png)

![screenshot of internal error page expanded](./screenshots/500_expanded.png)

When _sendErrorDetails_ is enabled the error details becomes available

![screenshot of internal error page with details expanded](./screenshots/500_expanded_and_details_enabled.png)

When used this error handler should be the last service implementing "handleError" because it catch all errors.
Any service catching a subset of error should be placed before this one as in the example below:

```js
import { startServer, jsenvServiceErrorHandler } from "@jsenv/server"

await startServer({
  services: [
    {
      handleError: (error) => {
        if (error.code === "FOO") {
          return {
            status: 500,
            headers: {
              "content-type": "text/plain",
            },
            body: 'Custom response for error with code "FOO"',
          }
        }
      },
    },
    jsenvServiceErrorHandler(),
  ],
})
```
