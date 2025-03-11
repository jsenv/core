import { createMagicSource } from "@jsenv/sourcemap";

const content = `import { inferContextFrom, createUrlContext } from "../url_context.js";
// toto
`;
const magic = createMagicSource(content);
magic.replace({
  start: 51,
  end: 70,
  replacement: `"/@fs/Users/d.maillard/dev/jsenv/core/src/internal/url_context.js"`,
});
const ret = magic.toContentAndSourcemap();
console.log(ret);
