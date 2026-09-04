import { MagicString } from "magic-string";

export const createMagicSource = (content) => {
  if (content === undefined) {
    throw new Error("content missing");
  }
  const magicString = new MagicString(content);
  let touched = false;
  // the edit list mirrors what magicString receives, in the coordinate
  // space of the initial content: it lets a consumer holding a sourcemap
  // for that initial content apply the edits as position shifts instead of
  // composing with a generated map (see sourcemap_edits.js)
  const edits = [];

  return {
    prepend: (string) => {
      touched = true;
      edits.push({ type: "prepend", text: string });
      magicString.prepend(string);
    },
    append: (string) => {
      touched = true;
      edits.push({ type: "append" });
      magicString.append(string);
    },
    replace: ({ start, end, replacement }) => {
      touched = true;
      edits.push({ type: "replace", start, end, replacement });
      magicString.overwrite(start, end, replacement);
    },
    insert: ({ position, text }) => {
      touched = true;
      edits.push({ type: "insert", position, text });
      magicString.appendLeft(position, text);
    },
    remove: ({ start, end }) => {
      touched = true;
      edits.push({ type: "remove", start, end });
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
        sourcemapEdits: { content, edits },
        get sourcemap() {
          if (map === undefined) {
            // "boundary" = a mapping per word boundary. Per-character maps
            // (hires: true) only add sub-word precision and cost ~25% of a
            // package build in generation + composition + GC; line-level maps
            // (hires: false) are cheaper still but collapse heavily rewritten
            // lines (JSX) to their edit points. Word precision is what
            // breakpoints, stack traces and devtools hovers actually consume.
            map = magicString.generateMap({
              hires: "boundary",
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
