/*
 * A link does not always move the tab it is in. A `target` naming another
 * browsing context (a new tab, a named window) loads the address there, in a
 * document of its own; a `download` saves it. The browser answers both
 * without touching this page, and that is the point of writing them: reading
 * the terms beside a half-filled form costs nothing. Routing such a link
 * would take this tab instead, and give no tab and no file.
 *
 * `_parent` and `_top` count as elsewhere too. Inside a frame they are; at the
 * top level the browser treats them as `_self` and loads a document, which
 * costs a load and nothing else.
 */

export const linkOpensElsewhere = (linkElement) => {
  const target = linkElement.getAttribute("target");
  if (target && target !== "_self") {
    return true;
  }
  return linkElement.hasAttribute("download");
};
