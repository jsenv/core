export const replacePlaceholdersInHtml = (html, replacers) => {
  return html.replace(/\$\{(\w+)\}/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    if (typeof replacer === "function") {
      return replacer();
    }
    return replacer;
  });
};
