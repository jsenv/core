import { MagicString } from "magic-string";

export const createMagicSource = (content) => {
  if (content === undefined) {
    throw new Error("content missing");
  }
  const magicString = new MagicString(content);
  let touched = false;

  return {
    prepend: (string) => {
      touched = true;
      magicString.prepend(string);
    },
    append: (string) => {
      touched = true;
      magicString.append(string);
    },
    replace: ({ start, end, replacement }) => {
      touched = true;
      magicString.overwrite(start, end, replacement);
    },
    remove: ({ start, end }) => {
      touched = true;
      magicString.remove(start, end);
    },
    toContentAndSourcemap: ({ source } = {}) => {
      if (!touched) {
        return {
          content,
          sourcemap: null,
        };
      }
      const code = magicString.toString();
      // The map is generated when first read, not here: a consumer that
      // throws sourcemaps away (a build with sourcemaps "none") never reads
      // it, and generating a high resolution map costs as much as the edit.
      let map;
      return {
        content: code,
        get sourcemap() {
          if (map === undefined) {
            map = magicString.generateMap({
              hires: true,
              includeContent: true,
              source,
            });
          }
          return map;
        },
      };
    },
  };
};
