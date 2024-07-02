import { assert } from "@jsenv/assert";
import { Abort } from "@jsenv/abort";

import { startServer } from "@jsenv/server";
import { portIsFree } from "@jsenv/server/src/internal/listen.js";

// pre-aborted
{
  const abortController = new AbortController();
  abortController.abort();
  let listenStartCallCount = 0;
  try {
    await startServer({
      signal: abortController.signal,
      keepProcessAlive: false,
      onListenStart: () => {
        listenStartCallCount++;
      },
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = {
      listenStartCallCount,
      isAbortError: Abort.isAbortError(e),
    };
    const expect = {
      listenStartCallCount: 0,
      isAbortError: true,
    };
    assert({ actual, expect });
  }
}

// aborted while starting to listen
{
  const abortController = new AbortController();
  const port = 4589;
  try {
    await startServer({
      signal: abortController.signal,
      port,
      keepProcessAlive: false,
      onListenStart: () => {
        abortController.abort();
      },
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = {
      isAbortError: Abort.isAbortError(e),
      portIsFree: await portIsFree(port, "0.0.0.0"),
    };
    const expect = {
      isAbortError: true,
      portIsFree: true,
    };
    assert({ actual, expect });
  }
}

// aborted onListenEnd
{
  const abortController = new AbortController();
  let port;
  try {
    await startServer({
      signal: abortController.signal,
      keepProcessAlive: false,
      onListenEnd: (value) => {
        port = value;
        abortController.abort();
      },
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = {
      isAbortError: Abort.isAbortError(e),
      portIsFree: await portIsFree(port, "0.0.0.0"),
    };
    const expect = {
      isAbortError: true,
      portIsFree: true,
    };
    assert({ actual, expect });
  }
}

// aborted afterwards
{
  const abortController = new AbortController();
  const server = await startServer({
    signal: abortController.signal,
    keepProcessAlive: false,
  });
  abortController.abort();
  const port = Number(new URL(server.origin).port);

  const actual = {
    portIsFree: await portIsFree(port, "0.0.0.0"),
  };
  const expect = {
    portIsFree: false,
  };
  assert({ actual, expect });
}
