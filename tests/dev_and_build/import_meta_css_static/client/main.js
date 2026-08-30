// static css: goes through the css pipeline (comments, minification, url())
import.meta.css = /* css */ `
  /* a comment */
  body {
    background-color: blue; /* trailing comment */
    background-image: url("./jsenv.png");
  }
`;

export const setBodyColor = (color) => {
  // dynamic css: left untouched, it is not static css
  import.meta.css = /* css */ `
    /* a comment */
    body {
      color: ${color};
    }
  `;
};
