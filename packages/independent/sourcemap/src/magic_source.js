import MagicString from "magic-string";

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
      const map = magicString.generateMap({
        hires: true,
        includeContent: true,
        source,
      });
      return {
        content: code,
        sourcemap: map,
      };
    },
  };
};
