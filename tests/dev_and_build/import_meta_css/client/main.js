import { setCssA } from "./a.js";
import { setCssB } from "./b.js";

// set CSS from both files
setCssA("red");
setCssB("blue");

const colorAfterInit = window.getComputedStyle(document.body).backgroundColor;
const fontColorAfterInit = window.getComputedStyle(document.body).color;

// update a.js CSS — b.js CSS (blue color) should remain
setCssA("green");

const colorAfterUpdate = window.getComputedStyle(document.body).backgroundColor;
const fontColorAfterUpdate = window.getComputedStyle(document.body).color;

window.resolveResultPromise({
  // red: a.js initial CSS applied
  colorAfterInit,
  // blue: b.js CSS applied
  fontColorAfterInit,
  // green: a.js CSS updated
  colorAfterUpdate,
  // blue: b.js CSS still active after a.js update
  fontColorAfterUpdate,
});
