import "/@fs@jsenv/core/src/plugins/import_meta_css/client/import_meta_css.js";import.meta.css = /*css*/ `body {
  background-color: red;
}`;

window.resolveResultPromise(
  window.getComputedStyle(document.body).backgroundColor,
);
