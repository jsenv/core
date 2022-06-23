import { assert } from "@jsenv/assert"

import { raceCallbacks } from "@jsenv/abort"

// can cancel race
{
  let cancelCallCount = 0
  const cancelRace = raceCallbacks(
    {
      event: () => {
        return () => {
          cancelCallCount++
        }
      },
    },
    () => {},
  )
  cancelRace()
  cancelRace()

  const actual = {
    cancelCallCount,
  }
  const expected = {
    cancelCallCount: 1,
  }
  assert({ actual, expected })
}

// callback called once race is cancelled do not call winner callback
{
  let winnerCallbackCallCount = 0
  let triggerCallback
  let removeCallbackCallCount = 0
  const cancelRace = raceCallbacks(
    {
      event: (cb) => {
        triggerCallback = cb
        return () => {
          removeCallbackCallCount++
        }
      },
    },
    () => {
      winnerCallbackCallCount++
    },
  )
  cancelRace()
  triggerCallback()
  const actual = {
    winnerCallbackCallCount,
    removeCallbackCallCount,
  }
  const expected = {
    winnerCallbackCallCount: 0,
    removeCallbackCallCount: 1,
  }
  assert({ actual, expected })
}
