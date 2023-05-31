import { assert } from "@jsenv/assert";

import { raceProcessTeardownEvents } from "@jsenv/abort";

const testTeardownEvent = (eventName) => {
  const listenersBeforeRace = process.listeners(eventName).length;
  const cancel = raceProcessTeardownEvents(
    {
      [eventName]: true,
    },
    () => {},
  );
  const listenersDiffDuringRace =
    process.listeners(eventName).length - listenersBeforeRace;
  cancel();
  const listenersDiffAfterRaceCancel =
    process.listeners(eventName).length - listenersBeforeRace;

  const actual = {
    listenersDiffDuringRace,
    listenersDiffAfterRaceCancel,
  };
  const expected = {
    listenersDiffDuringRace: 1,
    listenersDiffAfterRaceCancel: 0,
  };
  assert({ actual, expected });
};

testTeardownEvent("SIGINT");
testTeardownEvent("beforeExit");
testTeardownEvent("exit");
