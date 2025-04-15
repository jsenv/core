const meta = import.meta;

const url = import.meta.url;

const { url: urlDestructured } = import.meta;

const metaCopy = { ...meta };
metaCopy.url = metaCopy.url.replace(window.origin, "window.origin");
window.resolveResultPromise({
  meta: metaCopy,
  url: url.replace(window.origin, "window.origin"),
  urlDestructured: urlDestructured.replace(window.origin, "window.origin"),
  importMetaDev: undefined,
  importMetaTest: import.meta.test,
  importMetaBuild: true,
});