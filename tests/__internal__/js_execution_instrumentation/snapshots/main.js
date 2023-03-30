window.__supervisor__.jsModuleStart(import.meta.url);
import "./a.js";
try {
  await 42;
  window.__supervisor__.jsModuleEnd(import.meta.url);
} catch (e) {
  window.__supervisor__.jsModuleError(import.meta.url, e);
}