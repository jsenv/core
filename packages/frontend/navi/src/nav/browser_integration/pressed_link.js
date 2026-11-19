/**
 * The link a press was made on, and the address it leads to, read the same way
 * by both integrations (via_history.js, via_navigation.js).
 */
// The link a click was made on: through a shadow root too, where the click
// reaches window retargeted to the host.
export const findPressedLink = (event) => {
  for (const node of event.composedPath()) {
    if (node.localName === "a") {
      return node;
    }
  }
  return null;
};
// The address a link leads to: an `<a>` of SVG says it through an animated
// string, resolved against the document.
export const readLinkHref = (linkElement) => {
  const { href } = linkElement;
  if (typeof href === "string") {
    return href;
  }
  return new URL(href.baseVal, linkElement.baseURI).href;
};
