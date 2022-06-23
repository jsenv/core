import { assert } from "@jsenv/assert"

import { Abort } from "@jsenv/abort"

// operation.end() cleanup abort sources
{
  const operation = Abort.startOperation()

  let timeoutCleared = false
  operation.addAbortSource((abort) => {
    setTimeout(abort, 200)
    return () => {
      timeoutCleared = true
      clearTimeout(abort)
    }
  })

  operation.end()
  const actual = {
    timeoutCleared,
  }
  const expected = {
    timeoutCleared: true,
  }
  assert({ actual, expected })
}

// operation.end() await end callbacks
{
  const operation = Abort.startOperation()

  let endCallbackResolved
  operation.addEndCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
    endCallbackResolved = true
  })
  operation.addAbortSource((abort) => {
    abort()
  })

  await operation.end()

  const actual = {
    endCallbackResolved,
  }
  const expected = {
    endCallbackResolved: true,
  }
  assert({ actual, expected })
}

// operation.end({ abortAfterEnd: true }) and was not aborted
{
  const operation = Abort.startOperation()

  let abortEventCallbackCallCount = 0
  operation.signal.addEventListener(
    "abort",
    () => {
      abortEventCallbackCallCount++
    },
    { once: true },
  )
  let abortCallbackCallCount = 0
  operation.addAbortCallback(() => {
    abortCallbackCallCount++
  })
  await operation.end({
    abortAfterEnd: true,
  })
  const actual = {
    abortEventCallbackCallCount,
    abortCallbackCallCount,
  }
  const expected = {
    abortEventCallbackCallCount: 1,
    abortCallbackCallCount: 1,
  }
  assert({ actual, expected })
}
