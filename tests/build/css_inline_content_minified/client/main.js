/* globals __InlineContent__ */
import "@jsenv/core/src/plugins/reference_analysis/inline_content.js";

const content = new __InlineContent__(
  `@font-face {
    font-family: "Roboto";
    font-style: normal;
    font-weight: 400;
    src: local("Roboto"), url(./roboto_v27_latin_regular.woff2) format("woff2");
    font-display: swap;
  }`,
  { type: "text/css" },
);
console.log(content);
