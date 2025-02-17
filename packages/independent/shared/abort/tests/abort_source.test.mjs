import { assert } from "@jsenv/assert";

import { Abort } from "@jsenv/abort";

// abort source can abort the operation,
{
  const operation = Abort.startOperation();

  let timeoutCleared = false;
  const timeoutAbortSource = operation.addAbortSource((abort) => {
    const timeout = setTimeout(abort, 50);
    return () => {
      timeoutCleared = true;
      clearTimeout(timeout);
    };
  });

  await new Promise((resolve) => setTimeout(resolve, 200));

  try {
    operation.throwIfAborted();
    throw new Error("should throw");
  } catch (e) {
    const actual = {
      isAbortError: Abort.isAbortError(e),
      timeoutAbortSourceSignalAborted: timeoutAbortSource.signal.aborted,
      timeoutCleared,
      operationSignalAborted: operation.signal.aborted,
    };
    const expect = {
      isAbortError: true,
      timeoutAbortSourceSignalAborted: true,
      timeoutCleared: false,
      operationSignalAborted: true,
    };
    assert({ actual, expect });
  }
}

// aborting clear the timeout
{
  const operation = Abort.startOperation();

  let timeoutCleared = false;
  const timeoutAbortSource = operation.addAbortSource((abort) => {
    const timeout = setTimeout(abort, 5000);
    return () => {
      timeoutCleared = true;
      clearTimeout(timeout);
    };
  });
  const abortController = new AbortController();
  operation.addAbortSignal(abortController.signal);
  abortController.abort();

  const actual = {
    timeoutCleared,
    operationSignalAborted: operation.signal.aborted,
    timeoutSignalAborted: timeoutAbortSource.signal.aborted,
  };
  const expect = {
    timeoutCleared: true,
    operationSignalAborted: true,
    timeoutSignalAborted: false,
  };
  assert({ actual, expect });
}

// it's possible to remove abort source
{
  const operation = Abort.startOperation();

  let timeoutCleared = false;
  const timeoutAbortSource = operation.addAbortSource((abort) => {
    const timeout = setTimeout(abort, 50);
    return () => {
      timeoutCleared = true;
      clearTimeout(timeout);
    };
  });
  await Promise.resolve();
  timeoutAbortSource.remove();

  const actual = {
    timeoutCleared,
  };
  const expect = {
    timeoutCleared: true,
  };
  assert({ actual, expect });
}

// pre-aborted signal don't call the callback
{
  const operation = Abort.startOperation();
  operation.addAbortSource((abort) => {
    abort();
  });
  let callCount = 0;
  operation.addAbortSource(() => {
    callCount++;
  });
  const actual = {
    callCount,
  };
  const expect = {
    callCount: 0,
  };
  assert({ actual, expect });
}
