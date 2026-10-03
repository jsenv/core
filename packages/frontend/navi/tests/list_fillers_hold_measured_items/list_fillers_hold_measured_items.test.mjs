"jsenv:allocate 90s";

/*
 * The room a list holds for the items outside its window is the room they
 * took when it drew them.
 *
 * Reported from an application: flinging a thread of cards on a phone, the
 * cards jumped half a screen several times per fling. The window slid, the
 * cards leaving it at the top went back into the filler at the size given for
 * an item never drawn (the one-line item, 38px, for a 290px card), and what
 * stood above the screen lost 252px per card. A list puts such a change back
 * with a scroll write, but not into a scroll it would stop short — a fling on
 * iOS, a key, a smooth scrollTo, a script — and there it is what the eye sees.
 *
 * The page scrolls here the way a script does, which the list does not write
 * into, and under a finger flinging it, as on a phone. What it holds, for items the list has drawn: going down through them,
 * coming back up over them, and jumping back into them, nothing above the
 * screen changes — the scroll stays where it was put, and the rows with it.
 * The text the fillers carry for find in page follows: each line stands where
 * its item was drawn. What it does not hold: items never drawn are still sized
 * by a guess, and coming up over them from the end still changes what is above
 * the screen.
 */

import { startDevServer } from "@jsenv/core";
import { jsenvPluginPreact } from "@jsenv/plugin-preact";
import { snapshotTests } from "@jsenv/snapshot";
import { chromium } from "playwright";

const devServer = await startDevServer({
  logLevel: "off",
  serverLogLevel: "off",
  sourceDirectoryUrl: import.meta.resolve("../../"),
  keepProcessAlive: false,
  clientAutoreload: false,
  http2: false,
  port: 0,
  plugins: [jsenvPluginPreact()],
});

const browser = await chromium.launch({ headless: true });

// The dev server fills its own cache directory while cooking the page; those
// files are not what this test is about.
snapshotTests.prefConfigure({
  filesystemActions: {
    "**/.jsenv/": "ignore",
  },
});

const STEP = 300;

const openThread = async (search = "", { phone } = {}) => {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: phone,
    hasTouch: phone,
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(
    `${devServer.origin}/tests/list_fillers_hold_measured_items/client/main.html${search}`,
  );
  await page.waitForSelector("#thread [navi-list-item-real]");
  await page.evaluate(() => window.waitFrames(10)); // eslint-disable-line no-undef
  return { page, errors };
};

// What stands above the screen, step after step: how many steps changed it,
// by how much at most, and how much of it the list wrote back.
const scrollBy = async (page, stepCount, delta) => {
  let stepsChanging = 0;
  let largestChange = 0;
  let correctionTotal = 0;
  let index = 0;
  while (index < stepCount) {
    const { shift, correction } = await page.evaluate(
      (d) => window.step(d), // eslint-disable-line no-undef
      delta,
    );
    const size = Math.abs(shift);
    if (size > 2) {
      stepsChanging++;
    }
    if (size > largestChange) {
      largestChange = size;
    }
    correctionTotal += Math.abs(correction);
    index++;
  }
  return {
    steps: stepCount,
    steps_changing_what_is_above_the_screen: stepsChanging,
    largest_change_px: Math.round(largestChange),
    written_back_px: Math.round(correctionTotal),
  };
};

// A finger thrown up the screen (or down it), the way DevTools' touch
// emulation turns a mouse drag into one: pressed, moved faster and faster for
// nine frames, lifted. The browser flings on from there. Not awaited: under
// the emulation, the events are not acknowledged until the gesture is over,
// and some are still pending when the page closes, which rejects them.
const fling = async (cdp, direction) => {
  const x = 195;
  let y = direction === "down" ? 700 : 150;
  const send = (params) => {
    cdp
      .send("Input.dispatchMouseEvent", { x, button: "left", ...params })
      .catch(() => {});
  };
  send({ type: "mousePressed", y, buttons: 1, clickCount: 1 });
  let move = 0;
  while (move < 9) {
    await wait(16);
    const distance = 6 + move * 6.5;
    y = direction === "down" ? y - distance : y + distance;
    send({ type: "mouseMoved", y, buttons: 1 });
    move++;
  }
  await wait(16);
  send({ type: "mouseReleased", y, buttons: 0, clickCount: 1 });
  // Until the fling has landed.
  await wait(1800);
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readTopRow = (page) => page.evaluate(() => window.readTopRow()); // eslint-disable-line no-undef

try {
  await snapshotTests(import.meta.url, ({ test }) => {
    test("down through the cards, back up over them, then back into them", async () => {
      const { page, errors } = await openThread();
      try {
        const down = await scrollBy(page, 30, STEP);
        const topRowThere = await readTopRow(page);
        const scrollThere = await page.evaluate(() => window.readScroll()); // eslint-disable-line no-undef
        const furtherDown = await scrollBy(page, 10, STEP);
        const up = await scrollBy(page, 30, -STEP);
        await page.evaluate((top) => window.jumpTo(top), scrollThere); // eslint-disable-line no-undef
        const topRowBackThere = await readTopRow(page);
        const findLines = await page.evaluate(() => window.checkFindLines()); // eslint-disable-line no-undef
        return {
          down: { ...down, then_further: furtherDown },
          up,
          back_into_them: {
            scroll: scrollThere,
            top_row_on_the_way_down: topRowThere,
            top_row_jumping_back: topRowBackThere,
          },
          find_lines_of_items_drawn_before: {
            checked: findLines.checked,
            away_from_where_their_item_was_drawn: findLines.off,
          },
          errors,
        };
      } finally {
        await page.close();
      }
    });
    test("six flings down the thread on a phone, three back up", async () => {
      const { page, errors } = await openThread("", { phone: true });
      try {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setEmitTouchEventsForMouse", {
          enabled: true,
          configuration: "mobile",
        });
        await page.evaluate(() => window.startFrames()); // eslint-disable-line no-undef
        let index = 0;
        while (index < 6) {
          await fling(cdp, "down");
          index++;
        }
        const down = await page.evaluate(() => window.stopFrames()); // eslint-disable-line no-undef
        await page.evaluate(() => window.startFrames()); // eslint-disable-line no-undef
        index = 0;
        while (index < 3) {
          await fling(cdp, "up");
          index++;
        }
        const up = await page.evaluate(() => window.stopFrames()); // eslint-disable-line no-undef
        return {
          down: {
            reached_the_cards: down.scrollY > 30 * 38,
            frames_where_the_rows_jump: down.jumps,
          },
          up: {
            came_back_up: up.scrollY < down.scrollY,
            frames_where_the_rows_jump: up.jumps,
          },
          errors,
        };
      } finally {
        await page.close();
      }
    });
    test("opening at the end, then up over cards never drawn", async () => {
      const { page, errors } = await openThread("?open=end");
      try {
        // A screen and a half of cards, sized on the cards drawn there and not
        // on the one-line items the first commit draws before the runs have
        // said how many items there are.
        const opening = await page.evaluate(() => window.readOpening()); // eslint-disable-line no-undef
        const up = await scrollBy(page, 20, -STEP);
        return {
          opening,
          items_above_still_guessed:
            up.steps_changing_what_is_above_the_screen > 0 ||
            up.written_back_px > 0,
          errors,
        };
      } finally {
        await page.close();
      }
    });
  });
} finally {
  await browser.close();
  devServer.stop();
}
