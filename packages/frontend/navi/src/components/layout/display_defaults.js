const DEFAULT_DISPLAY_BY_TAG_NAME = {
  "inline": new Set([
    "a",
    "abbr",
    "b",
    "bdi",
    "bdo",
    "br",
    "button",
    "cite",
    "code",
    "dfn",
    "em",
    "i",
    "kbd",
    "label",
    "mark",
    "q",
    "s",
    "samp",
    "small",
    "span",
    "strong",
    "sub",
    "sup",
    "time",
    "u",
    "var",
    "wbr",
    "area",
    "audio",
    "img",
    "map",
    "track",
    "video",
    "embed",
    "iframe",
    "object",
    "picture",
    "portal",
    "source",
    "svg",
    "math",
    "input",
    "meter",
    "output",
    "progress",
    "select",
    "textarea",
  ]),
  "block": new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "div",
    "dl",
    "fieldset",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul",
    "video",
    "canvas",
    "details",
    "dialog",
    "dd",
    "dt",
    "figcaption",
    "li",
    "summary",
    "caption",
    "colgroup",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
  ]),
  "inline-block": new Set([
    "button",
    "input",
    "select",
    "textarea",
    "img",
    "video",
    "audio",
    "canvas",
    "embed",
    "iframe",
    "object",
  ]),
  "table-cell": new Set(["td", "th"]),
  "table-row": new Set(["tr"]),
  "list-item": new Set(["li"]),
  "none": new Set([
    "head",
    "meta",
    "title",
    "link",
    "style",
    "script",
    "noscript",
    "template",
    "slot",
  ]),
};

// Create a reverse map for quick lookup: tagName -> display value
const TAG_NAME_TO_DEFAULT_DISPLAY = new Map();
for (const display of Object.keys(DEFAULT_DISPLAY_BY_TAG_NAME)) {
  const displayTagnameSet = DEFAULT_DISPLAY_BY_TAG_NAME[display];
  for (const tagName of displayTagnameSet) {
    TAG_NAME_TO_DEFAULT_DISPLAY.set(tagName, display);
  }
}

/**
 * Get the default CSS display value for a given HTML tag name
 * @param {string} tagName - The HTML tag name (case-insensitive)
 * @returns {string} The default display value ("block", "inline", "inline-block", etc.) or "inline" as fallback
 * @example
 * getDefaultDisplay("div")      // "block"
 * getDefaultDisplay("span")     // "inline"
 * getDefaultDisplay("img")      // "inline-block"
 * getDefaultDisplay("unknown")  // "inline" (fallback)
 */
export const getDefaultDisplay = (tagName) => {
  const normalizedTagName = tagName.toLowerCase();
  return TAG_NAME_TO_DEFAULT_DISPLAY.get(normalizedTagName) || "inline";
};
