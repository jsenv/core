/*
 * Browser side of requestAllocatedMs: reaches the process running the test plan
 * through a function playwright exposed on the page before navigating to it
 * (see using_playwright.js).
 */

export const requestAllocatedMs = (ms) => {
  if (typeof ms !== "number") {
    throw new TypeError(`requestAllocatedMs expects a number, got ${ms}`);
  }
  const requestAllocatedMsBinding = window.__jsenv_request_allocated_ms__;
  if (!requestAllocatedMsBinding) {
    // page opened on its own (dev server, browser tab): there is no allocated time
    return;
  }
  requestAllocatedMsBinding(ms);
};
