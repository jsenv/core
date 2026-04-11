import { createImportMetaHot } from "/@fs@jsenv/core/src/plugins/import_meta_hot/client/import_meta_hot.js";import.meta.hot = createImportMetaHot(import.meta.url);import { installImportMetaCssDev as __installImportMetaCssDev__ } from "/@fs@jsenv/core/src/plugins/import_meta_css/client/import_meta_css_dev.js";const remove = __installImportMetaCssDev__(import.meta);if (import.meta.hot) {  import.meta.hot.dispose(() => {    remove();  });}import.meta.css = /* css */ `
  body {
    background-color: red;
  }
`;

window.resolveResultPromise(
  window.getComputedStyle(document.body).backgroundColor,
);
