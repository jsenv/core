import { installImportMetaCssBuild as __installImportMetaCssBuild__ } from "/js/import_meta_css_build.js";__installImportMetaCssBuild__(import.meta);
import.meta.css = [         `body {
  background-color: #00f;
  background-image: url(/other/jsenv.png);
}
`, "@jsenv/core/tests/dev_and_build/import_meta_css_static/client/main.js"];
export const setBodyColor = color => {

  import.meta.css = [         `
    /* a comment */
    body {
      color: ${color};
    }
  `, "@jsenv/core/tests/dev_and_build/import_meta_css_static/client/main.js"];
};