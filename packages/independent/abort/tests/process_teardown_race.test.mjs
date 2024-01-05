import { assert } from "@jsenv/assert";

import { raceProcessTeardownEvents } from "@jsenv/abort";

const test = (eventName) => {
  const numberOfListenersAtStart = process.listeners(eventName).length;
  const countListeners = () => {
    return process.listeners(eventName).length - numberOfListenersAtStart;
  };

  const cancel = raceProcessTeardownEvents(
    {
      [eventName]: true,
    },
    () => {},
  );
  const numberOfListenersAddedDuringRace = countListeners();
  cancel();
  const numberOfListenersAfterRaceCleanup = countListeners();

  const actual = {
    numberOfListenersAddedDuringRace,
    numberOfListenersAfterRaceCleanup,
  };
  const expected = {
    numberOfListenersAddedDuringRace: 1,
    numberOfListenersAfterRaceCleanup: 0,
  };
  assert({ actual, expected });
};

test("SIGINT");
test("beforeExit");
test("exit");
