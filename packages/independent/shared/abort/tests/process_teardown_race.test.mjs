// https://github.com/un-ts/eslint-plugin-import-x/issues/305
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { raceProcessTeardownEvents } from "@jsenv/abort";
import { assert } from "@jsenv/assert";

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
  const expect = {
    numberOfListenersAddedDuringRace: 1,
    numberOfListenersAfterRaceCleanup: 0,
  };
  assert({ actual, expect });
};

test("SIGINT");
test("beforeExit");
test("exit");
