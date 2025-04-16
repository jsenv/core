import { assert } from "@jsenv/assert";

import { Abort } from "@jsenv/abort";

// operation.end() cleanup abort sources
{
  const operation = Abort.startOperation();

  let timeoutCleared = false;
  operation.addAbortSource((abort) => {
    setTimeout(abort, 200);
    return () => {
      timeoutCleared = true;
      clearTimeout(abort);
    };
  });

  operation.end();
  const actual = {
    timeoutCleared,
  };
  const expect = {
    timeoutCleared: true,
  };
  assert({ actual, expect });
}

// operation.end() await end callbacks
{
  const operation = Abort.startOperation();

  let endCallbackResolved;
  operation.addEndCallback(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    endCallbackResolved = true;
  });
  operation.addAbortSource((abort) => {
    abort();
  });

  await operation.end();

  const actual = {
    endCallbackResolved,
  };
  const expect = {
    endCallbackResolved: true,
  };
  assert({ actual, expect });
}

// operation.end({ abortAfterEnd: true }) and was not aborted
{
  const operation = Abort.startOperation();

  let abortEventCallbackCallCount = 0;
  operation.signal.addEventListener(
    "abort",
    () => {
      abortEventCallbackCallCount++;
    },
    { once: true },
  );
  let abortCallbackCallCount = 0;
  operation.addAbortCallback(() => {
    abortCallbackCallCount++;
  });
  await operation.end({
    abortAfterEnd: true,
  });
  const actual = {
    abortEventCallbackCallCount,
    abortCallbackCallCount,
  };
  const expect = {
    abortEventCallbackCallCount: 1,
    abortCallbackCallCount: 1,
  };
  assert({ actual, expect });
}
