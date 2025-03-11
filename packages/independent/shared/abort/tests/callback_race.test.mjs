import { assert } from "@jsenv/assert";

import { raceCallbacks } from "@jsenv/abort";

// can cancel race
{
  let cancelCallCount = 0;
  const cancelRace = raceCallbacks(
    {
      event: () => {
        return () => {
          cancelCallCount++;
        };
      },
    },
    () => {},
  );
  cancelRace();
  cancelRace();

  const actual = {
    cancelCallCount,
  };
  const expect = {
    cancelCallCount: 1,
  };
  assert({ actual, expect });
}

// callback called once race is cancelled do not call winner callback
{
  let winnerCallbackCallCount = 0;
  let triggerCallback;
  let removeCallbackCallCount = 0;
  const cancelRace = raceCallbacks(
    {
      event: (cb) => {
        triggerCallback = cb;
        return () => {
          removeCallbackCallCount++;
        };
      },
    },
    () => {
      winnerCallbackCallCount++;
    },
  );
  cancelRace();
  triggerCallback();
  const actual = {
    winnerCallbackCallCount,
    removeCallbackCallCount,
  };
  const expect = {
    winnerCallbackCallCount: 0,
    removeCallbackCallCount: 1,
  };
  assert({ actual, expect });
}
