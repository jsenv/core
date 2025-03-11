import { assert } from "@jsenv/assert";

export const assertErrorOverlayNotDisplayed = async (page, scenario) => {
  const actual = {
    scenario,
    errorOverlayDisplayed: await getErrorOverlayDisplayedOnPage(page),
  };
  const expect = {
    scenario,
    errorOverlayDisplayed: false,
  };
  assert({ actual, expect });
};
export const assertErrorOverlayDisplayed = async (page, scenario) => {
  const actual = {
    scenario,
    errorOverlayDisplayed: await getErrorOverlayDisplayedOnPage(page),
  };
  const expect = {
    scenario,
    errorOverlayDisplayed: true,
  };
  assert({ actual, expect });
};

const getErrorOverlayDisplayedOnPage = async (page) => {
  const errorOverlayHandle = await page.evaluate(
    /* eslint-disable no-undef */
    () => document.querySelector("jsenv-error-overlay"),
    /* eslint-enable no-undef */
  );
  return Boolean(errorOverlayHandle);
};
