/*
 * Waits for "window.answer" to reach an expected value, across reloads:
 * page.waitForFunction re-installs itself on the new document, which is what
 * makes it usable to assert the page came back on its own.
 */

export const waitForAnswer = async (
  page,
  expected,
  { timeout = 10_000 } = {},
) => {
  try {
    await page.waitForFunction(
      /* eslint-disable no-undef */
      (value) => window.answer === value,
      /* eslint-enable no-undef */
      expected,
      { timeout },
    );
  } catch {
    const actual = await page.evaluate(
      /* eslint-disable no-undef */
      () => window.answer,
      /* eslint-enable no-undef */
    );
    throw new Error(
      `timeout while waiting for window.answer to be ${expected} (it is ${actual})`,
    );
  }
};
