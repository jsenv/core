import { createMagicSource } from "@jsenv/sourcemap";

export const replacePlaceholders = (urlInfo, replacements) => {
  const content = urlInfo.content;
  const magicSource = createMagicSource(content);
  Object.keys(replacements).forEach((key) => {
    let index = content.indexOf(key);
    while (index !== -1) {
      const start = index;
      const end = index + key.length;
      magicSource.replace({
        start,
        end,
        replacement:
          urlInfo.type === "js_classic" ||
          urlInfo.type === "js_module" ||
          urlInfo.type === "html"
            ? JSON.stringify(replacements[key], null, "  ")
            : replacements[key],
      });
      index = content.indexOf(key, end);
    }
  });
  return magicSource.toContentAndSourcemap();
};
