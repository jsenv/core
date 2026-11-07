import { installImportMetaCssBuild as __installImportMetaCssBuild__ } from "/js/import_meta_css_build.js";

__installImportMetaCssBuild__(import.meta);

import "/js/constant.js";


import.meta.css =           [`body {
  background-color: #00f;
  background-image: url(/other/jsenv.png);
}
`, "import_meta_css_static/main.js"];



export const setBodyColor = (color) => {
  import.meta.css =           [`body {
  color: ${color};
}
`, "import_meta_css_static/main.js"];
};



export const setSelectorColor = (selector) => {
  import.meta.css =           [`
    /* a comment */
    ${selector} {
      color: red;
    }
  `, "import_meta_css_static/main.js"];
};