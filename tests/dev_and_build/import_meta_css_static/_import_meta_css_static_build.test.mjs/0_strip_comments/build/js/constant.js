import { installImportMetaCssBuild as __installImportMetaCssBuild__ } from "/js/import_meta_css_build.js";

__installImportMetaCssBuild__(import.meta);



const css =           `.constant {
  color: red;
}
`;
import.meta.css = [css, "import_meta_css_static/constant.js"];

export const constantCss = css;