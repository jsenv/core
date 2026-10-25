/**
 * What the clock says, for what is written from it: the day it is, and ticks
 * a text relative to now ages on.
 *
 * Each signal follows the clock only while something reads it, like
 * networkSpeedSignal: a page showing no date sets no timer. A timer alone is
 * not enough to follow it — a sleeping phone, a tab in the background, hold
 * timers back for as long as they like — so the clock is read again whenever
 * the page is looked at again (visibilitychange, focus).
 *
 * The signals are created at the bottom, once what creating them reads is
 * defined.
 */

import { signal } from "@preact/signals";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const toLocalDay = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const followClock = (update, delayToNextChange) => {
  let timeout;
  const schedule = () => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      update();
      schedule();
    }, delayToNextChange(new Date()));
  };
  const onLookedAtAgain = () => {
    if (document.hidden) {
      return;
    }
    update();
    schedule();
  };
  schedule();
  document.addEventListener("visibilitychange", onLookedAtAgain);
  window.addEventListener("focus", onLookedAtAgain);
  return () => {
    clearTimeout(timeout);
    document.removeEventListener("visibilitychange", onLookedAtAgain);
    window.removeEventListener("focus", onLookedAtAgain);
  };
};

const createClockSignal = (read, delayToNextChange) => {
  let stopFollowing;
  const clockSignal = signal(read(), {
    watched: () => {
      // Nothing listened before: what it holds may be from another day.
      clockSignal.value = read();
      stopFollowing = followClock(() => {
        clockSignal.value = read();
      }, delayToNextChange);
    },
    unwatched: () => {
      stopFollowing();
    },
  });
  return clockSignal;
};

/**
 * The local day, as "YYYY-MM-DD": it moves at midnight, for an app left open
 * overnight as much as one opened in the morning. Reading it in a render is
 * what makes "today" in that render follow the day.
 *
 * @type {import("@preact/signals").ReadonlySignal<string>}
 */
export const todaySignal = /*#__PURE__*/ createClockSignal(
  () => toLocalDay(new Date()),
  (now) => {
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
    );
    // A second past it: a timer may fire a hair early.
    return nextMidnight - now + 1000;
  },
);

// A tick on each second, on each minute and on each hour of the wall clock:
// what a duration running since an instant reads to count on (see `<Time
// type="duration" since>`), and a time relative to now to age on (see `<Time
// type="relative">`).
export const secondTickSignal = /*#__PURE__*/ createClockSignal(
  () => Math.floor(Date.now() / 1000),
  (now) => 1000 - (now.getTime() % 1000),
);
export const minuteTickSignal = /*#__PURE__*/ createClockSignal(
  () => Math.floor(Date.now() / MINUTE),
  (now) => MINUTE - (now.getTime() % MINUTE),
);
export const hourTickSignal = /*#__PURE__*/ createClockSignal(
  () => Math.floor(Date.now() / HOUR),
  (now) => HOUR - (now.getTime() % HOUR),
);
