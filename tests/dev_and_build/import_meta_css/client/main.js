import { setBodyBackgroundColor } from "./a.js";
import { setBodyColor } from "./b.js";
import { setBodyFontSize } from "./c.js";

const getBodyFontSize = () => window.getComputedStyle(document.body).fontSize;
const getBodyBackgroundColor = () =>
  window.getComputedStyle(document.body).backgroundColor;
const getBodyColor = () => window.getComputedStyle(document.body).color;
const captureStyles = () => {
  return {
    bodyFontSize: getBodyFontSize(),
    bodyBackgroundColor: getBodyBackgroundColor(),
    bodyColor: getBodyColor(),
  };
};

// Before any CSS is set, all properties should be at their defaults
const at_start = captureStyles();

// Each file manages its own stylesheet independently.
// When bundled, all files share one import.meta, so installImportMetaCssBuild
// is called multiple times. The idempotency check (sentinel symbol) ensures
// subsequent calls don't reset the already-installed state.
setBodyFontSize("42px");
setBodyBackgroundColor("red");
setBodyColor("blue");
const after_first_call = captureStyles();

// Updating a.js CSS must not affect b.js (color) or c.js (font-size) stylesheets
setBodyBackgroundColor("green");
const after_second_call = captureStyles();

window.resolveResultPromise({
  at_start,
  after_first_call,
  after_second_call,
});
