import { createImportMetaHot } from "/@fs@jsenv/core/src/plugins/import_meta_hot/client/import_meta_hot.js";import.meta.hot = createImportMetaHot(import.meta.url);import { installImportMetaCssDev as __installImportMetaCssDev__ } from "/@fs@jsenv/core/src/plugins/import_meta_css/client/import_meta_css_dev.js";const remove = __installImportMetaCssDev__(import.meta);if (import.meta.hot) {  import.meta.hot.dispose(() => {    remove();  });}export const setBodyFontSize = (size) => {
  import.meta.css = /* css */ `
    body {
      font-size: ${size};
    }
  `;
};

// Called at module evaluation time so that installImportMetaCssBuild runs for
// c.js before a.js and b.js are imported. This lets us verify that subsequent
// installImportMetaCssBuild calls (from a.js and b.js) are idempotent and do
// not reset the stylesheet state already established by c.js.
setBodyFontSize("16px");
