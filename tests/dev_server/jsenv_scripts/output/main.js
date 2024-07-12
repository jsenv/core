import { createImportMetaHot } from "/@fs/mock/src/plugins/import_meta_hot/client/import_meta_hot.js";
import.meta.hot = createImportMetaHot(import.meta.url);
import { value } from "/a.js";

document.querySelector("#app").innerHTML = value;

if (import.meta.hot) {
  import.meta.hot.accept();
}
