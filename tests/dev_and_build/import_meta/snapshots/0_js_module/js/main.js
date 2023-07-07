const meta = import.meta;

const url = import.meta.url;

const { url: urlDestructured } = import.meta;

window.resolveResultPromise({
  meta,
  url,
  urlDestructured,
  importMetaDev: undefined,
  importMetaTest: import.meta.test,
  importMetaBuild: true,
});
