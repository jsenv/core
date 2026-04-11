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

const at_start = captureStyles();

// c.js is first: its installImportMetaCssBuild runs first
// a.js and b.js calls must be idempotent (not reset the state)
setBodyFontSize("42px");
setBodyBackgroundColor("red");
setBodyColor("blue");
const after_first_call = captureStyles();

// update a.js CSS — b.js CSS (blue color) and c.js CSS (42px) should remain
setBodyBackgroundColor("green");
const after_second_call = captureStyles();

window.resolveResultPromise({
  at_start,
  after_first_call,
  after_second_call,
});
