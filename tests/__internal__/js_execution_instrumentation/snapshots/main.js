window.reportJsModuleStart(import.meta.url);
import "./a.js";
try {
  await 42;
  window.reportJsModuleEnd(import.meta.url);
} catch (e) {
  window.reportJsModuleError(import.meta.url, e);
}