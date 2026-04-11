import { setBodyBackgroundColor } from "./a.js";
import { setBodyColor } from "./b.js";

// set CSS from both files
setBodyBackgroundColor("red");
setBodyColor("blue");

const bodyBackgroundColorAfterInit = window.getComputedStyle(
  document.body,
).backgroundColor;
const bodyColorAfterInit = window.getComputedStyle(document.body).color;

// update a.js CSS — b.js CSS (blue color) should remain
setBodyBackgroundColor("green");

const bodyBackgroundColorAfterUpdate = window.getComputedStyle(
  document.body,
).backgroundColor;
const bodyColorAfterUpdate = window.getComputedStyle(document.body).color;

window.resolveResultPromise({
  // red: a.js initial CSS applied
  bodyBackgroundColorAfterInit,
  // blue: b.js CSS applied
  bodyColorAfterInit,
  // green: a.js CSS updated
  bodyBackgroundColorAfterUpdate,
  // blue: b.js CSS still active after a.js update
  bodyColorAfterUpdate,
});
