import.meta.css = /* css */ `
  body {
    color: blue;
    background-color: red;
  }
`;

const colorAfterFirst = window.getComputedStyle(document.body).backgroundColor;
const fontColorAfterFirst = window.getComputedStyle(document.body).color;

import.meta.css = /* css */ `
  body {
    background-color: green;
  }
`;

const colorAfterSecond = window.getComputedStyle(document.body).backgroundColor;
const fontColorAfterSecond = window.getComputedStyle(document.body).color;

window.resolveResultPromise({
  colorAfterFirst,
  fontColorAfterFirst,
  colorAfterSecond,
  // green means background-color was updated
  // and blue means color: blue was removed (not inhereted/overridden)
  fontColorAfterSecond,
});
