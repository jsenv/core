// "const css = ...; import.meta.css = css": the css is where the constant is
// declared, and the build reads it there
const css = /* css */ `
  /* a comment */
  .constant {
    color: red;
  }
`;
import.meta.css = css;

export const constantCss = css;
