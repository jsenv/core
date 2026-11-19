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

/*
 * …and a press does not always follow a link here either. A modifier key asks
 * the browser for something other than this tab: a new tab (meta on macOS,
 * ctrl elsewhere), a new window (shift), a download (alt); a button other than
 * the main one is the browser's too. The reader stays where they are, so the
 * press is the browser's alone: the routing leaves it be, and so does the
 * link's own work — its command, its action (see the link and button reactions
 * in control_hooks.jsx). A link that opens elsewhere by what it is (above) is
 * different: that press is the way out, and the link's work goes with it.
 */
export const pressOpensElsewhere = (event) => {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  );
};
