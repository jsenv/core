import { setBodyBackgroundColor } from "./a.js";
import { setBodyColor } from "./b.js";
import { setBodyFontSize } from "./c.js";

// c.js is first: its installImportMetaCssBuild runs first
// a.js and b.js calls must be idempotent (not reset the state)
setBodyFontSize("42px");
setBodyBackgroundColor("red");
setBodyColor("blue");

const bodyBackgroundColorAfterInit = window.getComputedStyle(
  document.body,
).backgroundColor;
const bodyColorAfterInit = window.getComputedStyle(document.body).color;
// 42px: c.js CSS must survive subsequent installImportMetaCssBuild calls from a.js and b.js
const bodyFontSizeAfterInit = window.getComputedStyle(document.body).fontSize;

// update a.js CSS — b.js CSS (blue color) and c.js CSS (42px) should remain
setBodyBackgroundColor("green");

const bodyBackgroundColorAfterUpdate = window.getComputedStyle(
  document.body,
).backgroundColor;
const bodyColorAfterUpdate = window.getComputedStyle(document.body).color;
const bodyFontSizeAfterUpdate = window.getComputedStyle(document.body).fontSize;

window.resolveResultPromise({
  // red: a.js initial CSS applied
  bodyBackgroundColorAfterInit,
  // blue: b.js CSS applied
  bodyColorAfterInit,
  // 42px: c.js top-level CSS survived subsequent installImportMetaCssBuild calls
  bodyFontSizeAfterInit,
  // green: a.js CSS updated
  bodyBackgroundColorAfterUpdate,
  // blue: b.js CSS still active after a.js update
  bodyColorAfterUpdate,
  // 42px: c.js CSS still active after a.js update
  bodyFontSizeAfterUpdate,
});
