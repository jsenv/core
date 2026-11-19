/*
 * Coming back to a list: who decides that it asks the server again.
 *
 * The answer belongs to the SOURCE the list reads through, and to nothing else
 * — not to the back button, and above all not to the movement playing between
 * the two pages. A relation is a statement about the app's map; it must not
 * also decide what the page arriving is allowed to do.
 *
 * The regression this holds was reported from an application: a list stopped
 * asking again on the way back as soon as `defineRouteTransition` was written
 * for the pair it was walked through. The app is mounted twice here, in the
 * shape such a transition is defined in (pages between fixed bars, a marked
 * area, a `Loading` boundary, a list long enough to hold rows it does not
 * draw), and the two mounts differ by that one line.
 *
 * What each way of reading answers, on the way back:
 * - `routeAction` + `GET_MANY` — nothing goes out: the action holds its
 *   response, and a page wanting fresh rows says `.rerun()` (see
 *   docs/list_refresh.md).
 * - `<List.Items>` + `GET_RANGE` — one ask goes out: the reader kept the
 *   composition, not the rows, and the window it draws is read again while the
 *   ranks from before stay on screen.
 * Both numbers must be the same with and without the movement.
 */

// ten revisits per page, each waiting for a transition to have played
// and a revalidation to have had time to ask, in each engine
"jsenv:allocate 240s";

import { snapshotTests } from "@jsenv/snapshot";

import {
  configureBrowserSnapshots,
  createEngineTests,
  ENGINES,
  startNaviDevServer,
} from "../browser_harness.mjs";

const clientDirectoryUrl = import.meta.resolve("./client/");
// Every url the app routes to is served the app's html, the way a real server
// serving a single page application does.
const jsenvPluginRouteFallback = () => {
  return {
    name: "list_revisit_fallback",
    redirectReference: (reference) => {
      if (reference.isInline || !reference.url.startsWith("file:")) {
        return null;
      }
      const { pathname, search } = new URL(reference.url);
      for (const name of [
        "plain",
        "animated",
        "animated_default",
        "plain_wm",
        "animated_wm",
      ]) {
        if (pathname.includes(`/client/${name}/item/`)) {
          return `${clientDirectoryUrl}${name}/${name}.html${search}`;
        }
      }
      return null;
    },
  };
};

const devServer = await startNaviDevServer({
  plugins: [jsenvPluginRouteFallback()],
});
const pageUrlOf = (name, search = "") =>
  `${devServer.origin}/tests/route_transition_list_revisit/client/${name}/${name}.html${search}`;

// The movement is what the two mounts differ by, so a mount that played none
// would make the comparison say nothing: the attribute the root wears for the
// length of a transition is watched, and its ARRIVALS are counted. Only its
// arrivals — the observer is filtered to that one attribute and reads the edge
// rather than the presence, so neither a rewrite of the attribute nor anything
// else written to the root while a movement plays lands in the number.
const watchTransitions = (page) =>
  page.addInitScript(() => {
    /* eslint-disable no-undef */
    window.transitionsPlayed = 0;
    document.addEventListener("DOMContentLoaded", () => {
      const isPlaying = () =>
        document.documentElement.hasAttribute("data-navi-route-transition");
      // A movement already playing when the watch starts has played.
      let wasPlaying = isPlaying();
      if (wasPlaying) {
        window.transitionsPlayed++;
      }
      new MutationObserver(() => {
        const playing = isPlaying();
        if (playing === wasPlaying) {
          return;
        }
        wasPlaying = playing;
        if (playing) {
          window.transitionsPlayed++;
        }
      }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-navi-route-transition"],
      });
    });
    /* eslint-enable no-undef */
  });

const readAsks = (page) =>
  page.evaluate(() => {
    /* eslint-disable no-undef */
    return {
      range_asks: window.rangeCalls.length,
      many_asks: window.manyCalls.length,
    };
    /* eslint-enable no-undef */
  });
// The transition runs 300ms; the ask that a revalidation sends is looked for
// well past it, so "not yet" and "never" cannot be read as the same thing.
// This wait is paid eleven times per walk: a second is the margin, not more.
const settle = (page) => page.waitForTimeout(1000);
// Nothing is measured on the page opened on the way out — only the movement
// has to have played out before the way back begins. On a loaded machine it
// can still be playing past the 400ms: a back pressed then takes it over, and
// the two movements reach the count as one.
const settleLeaving = async (page) => {
  await page.waitForTimeout(400);
  await page.waitForFunction(
    () =>
      // eslint-disable-next-line no-undef
      !document.documentElement.hasAttribute("data-navi-route-transition"),
  );
};

// One comparison decides nothing about a failure that comes and goes: a
// difference that shows up three times out of four passes a single run a
// quarter of the time. The way back is therefore walked REPEATEDLY, and what
// the snapshot holds is the whole sequence — "1111111111" says the re-read
// went out on every one of ten revisits, and any other string is a race caught
// in the act rather than a coin toss that landed well.
const CYCLES = 10;
// Both decors name the row that opens the detail page the same way.
const OPEN_ROW = "[data-testid=item_open]";

// Pressing back the moment the URL changes is not pressing back from the page:
// the document's rendering is held for the frame the browser needs to
// photograph the page being left, so at that instant the address says one page
// and the screen still shows the other. A back from there returns from
// nowhere — nothing unmounted, so nothing remounts.
const openAndComeBack = async (
  browser,
  name,
  { search = "", rushBack = false } = {},
) => {
  const page = await browser.newPage();
  await watchTransitions(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    // The run's budget ("jsenv:allocate") is the limit: under a full test run
    // the first load, which cooks all of navi, outlasts Playwright's 30s.
    await page.goto(pageUrlOf(name, search), { timeout: 0 });
    await page.waitForSelector(OPEN_ROW);
    await settle(page);
    const onFirstLoad = await readAsks(page);
    const revisits = [];
    let cycle = 0;
    while (cycle < CYCLES) {
      const before = await readAsks(page);
      // The node on screen now, to be compared with the one that comes back:
      // a revisit that never unmounted gives back the very same element.
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        window.listNodeWas = document.querySelector("#list_page");
      });
      await page.locator(OPEN_ROW).first().click();
      if (rushBack) {
        await page.waitForURL(/\/item\//);
      } else {
        await page.waitForSelector("#item_page");
        await settleLeaving(page);
      }
      await page.goBack();
      await page.waitForSelector(OPEN_ROW);
      await settle(page);
      const after = await readAsks(page);
      revisits.push({
        range: after.range_asks - before.range_asks,
        many: after.many_asks - before.many_asks,
        rows: await page.locator(OPEN_ROW).count(),
        sameNode: await page.evaluate(
          // eslint-disable-next-line no-undef
          () => window.listNodeWas === document.querySelector("#list_page"),
        ),
      });
      cycle++;
    }
    return {
      on_first_load: onFirstLoad,
      // One digit per revisit, in order.
      range_asked_on_each_revisit: revisits.map((r) => r.range).join(""),
      many_asked_on_each_revisit: revisits.map((r) => r.many).join(""),
      // The rows are drawn every time, whatever the ask did: a page coming
      // back empty and a page coming back stale are not the same failure.
      rows_drawn_on_each_revisit: revisits.map((r) => r.rows).join(","),
      // "S" where the list that came back is the element that was already
      // there — a page that never left, not a page that came back.
      same_node_on_each_revisit: revisits
        .map((r) => (r.sameNode ? "S" : "-"))
        .join(""),
      transitions_played: await page.evaluate(
        () => window.transitionsPlayed, // eslint-disable-line no-undef
      ),
      transition_left_on_root: await page.evaluate(() =>
        // eslint-disable-next-line no-undef
        document.documentElement.hasAttribute("data-navi-route-transition"),
      ),
      errors,
    };
  } finally {
    await page.close();
  }
};

configureBrowserSnapshots();

// Each mount lives on its own page with its own counters, so the mounts of an
// engine are walked at once and the fixed waits they are made of overlap
// instead of adding up. The outcome is held behind a function: a walk that
// fails does so inside the test that reads it, not as a rejection racing ahead
// of every test.
const walk = (browser, name, options) => {
  const promise = openAndComeBack(browser, name, options).then(
    (value) => ({ value }),
    (error) => ({ error }),
  );
  return async () => {
    const { value, error } = await promise;
    if (error) {
      throw error;
    }
    return value;
  };
};

// Turning a movement round inside it: back, forward, back (and once more
// forward) while the push still plays — history keys pressed fast, a toggle
// link pressed three times. The movement takes one hold on the document's
// rendering at its first way back; every later turn must leave nothing taken,
// or the app stops drawing for the rest of the session — the address says one
// page, the screen keeps the other, and a press changes nothing. So the walk
// ends on a press made after it: it must draw the page it opens.
//
// Each turn is asked when the previous one has landed in the history
// (popstate), which is a few milliseconds: all of them inside the movement,
// and none of them taken back by the next before the browser applied it.
const turnRound = async (browser, name, turns) => {
  const page = await browser.newPage();
  await watchTransitions(page);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const movementOver = () =>
    page.waitForFunction(
      () =>
        // eslint-disable-next-line no-undef
        !document.documentElement.hasAttribute("data-navi-route-transition"),
      null,
      { timeout: 4000 },
    );
  const shows = async () => {
    await movementOver().catch(() => {});
    await page.waitForTimeout(100);
    return page.evaluate(() => ({
      // eslint-disable-next-line no-undef
      path: window.location.pathname.replace(/^.*\/client\/[^/]+\//, "/"),
      // eslint-disable-next-line no-undef
      list: Boolean(document.querySelector("#list_page")),
      // eslint-disable-next-line no-undef
      item: Boolean(document.querySelector("#item_page")),
      // eslint-disable-next-line no-undef
      movement_on_root: document.documentElement.hasAttribute(
        "data-navi-route-transition",
      ),
    }));
  };
  try {
    await page.goto(pageUrlOf(name), { timeout: 0 });
    await page.waitForSelector(OPEN_ROW);
    await page.locator(OPEN_ROW).first().click();
    await page.waitForFunction(() =>
      // eslint-disable-next-line no-undef
      document.documentElement.hasAttribute("data-navi-route-transition"),
    );
    const turnsInMovement = await page.evaluate(
      (count) =>
        new Promise((resolve) => {
          /* eslint-disable no-undef */
          let done = 0;
          const inMovement = [];
          const turn = () => {
            if (done === count) {
              window.removeEventListener("popstate", onPopstate);
              resolve(inMovement);
              return;
            }
            inMovement.push(
              document.documentElement.hasAttribute(
                "data-navi-route-transition",
              ),
            );
            if (done % 2 === 0) {
              history.back();
            } else {
              history.forward();
            }
            done++;
          };
          const onPopstate = () => {
            turn();
          };
          window.addEventListener("popstate", onPopstate);
          turn();
          /* eslint-enable no-undef */
        }),
      turns,
    );
    const after_turns = await shows();
    // a press after the turns, to the other page
    const landsOnList = turns % 2 === 1;
    let pressed_after;
    if (landsOnList) {
      pressed_after = await page
        .locator(OPEN_ROW)
        .first()
        .click({ timeout: 2000 })
        .then(() => page.waitForSelector("#item_page", { timeout: 4000 }))
        .then(
          () => "item page drawn",
          () => "nothing drawn",
        );
    } else {
      await page.goBack();
      pressed_after = await page
        .waitForSelector("#list_page", { timeout: 4000 })
        .then(
          () => "list page drawn",
          () => "nothing drawn",
        );
    }
    return {
      turns_asked_while_the_push_played: turnsInMovement.every(Boolean),
      after_turns,
      pressed_after,
      after_press: await shows(),
      errors,
    };
  } finally {
    await page.close();
  }
};

// A rushed back races the single frame where rendering is held, and which side
// of that race a cycle lands on belongs to the machine's load, not to navi: a
// busy run pushes `goBack` past the frame, a quiet one keeps it inside, and
// any mix of the two is a legitimate draw. A snapshot holding the
// digit-by-digit sequence would hold the draw. What navi owes — and what the
// snapshot holds — is the law every cycle must obey whichever side it lands
// on: a list that never left is the same element and asks nothing; one that
// truly came back is remounted and asks exactly once. Ten lawful cycles
// collapse to one fixed sentence; a cycle that breaks the law (an ask without
// a remount, a remount without an ask, a double ask) surfaces the raw
// sequences so the snapshot diff shows the evidence.
const summarizeRushedRevisits = (walkResult) => {
  const {
    range_asked_on_each_revisit,
    same_node_on_each_revisit,
    ...stableFields
  } = walkResult;
  const unlawfulCycles = [];
  for (let cycle = 0; cycle < CYCLES; cycle++) {
    const asked = range_asked_on_each_revisit[cycle];
    const sameNode = same_node_on_each_revisit[cycle];
    const neverLeft = sameNode === "S" && asked === "0";
    const trulyCameBack = sameNode === "-" && asked === "1";
    if (!neverLeft && !trulyCameBack) {
      unlawfulCycles.push(cycle);
    }
  }
  if (unlawfulCycles.length > 0) {
    return {
      ...stableFields,
      revisits: {
        range_asked_on_each_revisit,
        same_node_on_each_revisit,
        unlawful_cycles: unlawfulCycles,
      },
    };
  }
  return {
    ...stableFields,
    revisits: `${CYCLES}/${CYCLES} lawful: never left (same node, no ask) or truly came back (remounted, one ask)`,
  };
};

const { browserOf, closeBrowsers } = createEngineTests();
// The walks of an engine, started once, by the first test that reads them.
const walksByEngine = new Map();
const walksOf = async (engine) => {
  let walks = walksByEngine.get(engine);
  if (!walks) {
    // The rushed pair is not in this batch: a rushed back is a race against
    // the single frame where rendering is held, and the load of seven pages
    // cooking and walking at once is enough to push `goBack` past that frame.
    // It runs in its own test, on a machine this batch has left quiet.
    const browser = await browserOf(engine);
    walks = {
      plain: walk(browser, "plain"),
      animated: walk(browser, "animated"),
      animated_default: walk(browser, "animated_default"),
      plain_held: walk(browser, "plain", { search: "?at=item_400" }),
      animated_held: walk(browser, "animated", { search: "?at=item_400" }),
      plain_wm: walk(browser, "plain_wm"),
      animated_wm: walk(browser, "animated_wm"),
    };
    walksByEngine.set(engine, walks);
  }
  return walks;
};

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    // Engine after engine, so the walks of one do not load the machine the
    // other one's movements are timed on.
    for (const engine of ENGINES) {
      test(`a list revisited ten times, with and without a movement on the pair (${engine})`, async () => {
        const walks = await walksOf(engine);
        return {
          without_transition: await walks.plain(),
          with_transition: await walks.animated(),
          // the default movement every navigation takes, ordered by history
          with_default_transition: await walks.animated_default(),
        };
      });

      // The same walk on a list held on a row the URL names: the window it
      // comes back to is decided in the same frames as the re-read, which is
      // where a hold and an ask can pass each other.
      test(`a list held on a row named by the url, revisited ten times (${engine})`, async () => {
        const walks = await walksOf(engine);
        return {
          without_transition: await walks.plain_held(),
          with_transition: await walks.animated_held(),
        };
      });

      // The opposite decor, and the one a report came from: ONE row, the page
      // as the scroller, the list opening on its last rows, and a count known
      // from elsewhere before any row is drawn. Nothing is virtualized away
      // here — no window ever has to move — which exercises the other half of
      // the run.
      test(`a one-row list against the document scroller, revisited ten times (${engine})`, async () => {
        const walks = await walksOf(engine);
        return {
          without_transition: await walks.plain_wm(),
          with_transition: await walks.animated_wm(),
        };
      });

      // Back pressed the instant the URL changes, which no thumb can do and a
      // test does by default: `waitForURL` resolves while the rendering is
      // still held, so the page being left is still the page on screen. Under
      // a movement the list is then never unmounted — `same_node_on_each_revisit`
      // says so, it is the same element — and a list that never left has no
      // revisit to make. Without a movement nothing is held, the page has
      // already changed by then, and the walk is a real one.
      //
      // This is the whole of a bug report we received, and it is a test
      // writing a navigation that cannot happen rather than anything navi
      // does wrong. Waiting for the arriving page instead of for its address
      // is the fix, and the three tests above are what that looks like.
      test(`back pressed before the page being opened has rendered (${engine})`, async () => {
        const browser = await browserOf(engine);
        const [without_transition, with_transition] = await Promise.all([
          openAndComeBack(browser, "plain_wm", { rushBack: true }),
          openAndComeBack(browser, "animated_wm", { rushBack: true }),
        ]);
        return {
          without_transition: summarizeRushedRevisits(without_transition),
          with_transition: summarizeRushedRevisits(with_transition),
        };
      });

      test(`a movement turned round inside it (${engine})`, async () => {
        const browser = await browserOf(engine);
        return {
          "back, forward, back": {
            on_the_pair: await turnRound(browser, "animated", 3),
            default_movement: await turnRound(browser, "animated_default", 3),
          },
          "back, forward, back, forward": {
            on_the_pair: await turnRound(browser, "animated", 4),
            default_movement: await turnRound(browser, "animated_default", 4),
          },
        };
      });
    }
  });
} finally {
  await closeBrowsers();
  devServer.stop();
}
