import "./constant.js";

// static css: goes through the css pipeline (comments, minification, url())
import.meta.css = /* css */ `
  /* a comment */
  body {
    background-image: url("./jsenv.png");
    background-color: blue; /* trailing comment */
  }
`;

// a substitution standing where a css value stands: the css is still readable,
// the expression takes its placeholder's place back
export const setBodyColor = (color) => {
  import.meta.css = /* css */ `
    /* a comment */
    body {
      color: ${color};
    }
  `;
};

// a substitution standing anywhere else: nothing can stand for it, the css
// is shipped as it is written
export const setSelectorColor = (selector) => {
  import.meta.css = /* css */ `
    /* a comment */
    ${selector} {
      color: red;
    }
  `;
};
