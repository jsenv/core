/*
 * An app can ship more than one document — an admin panel, a status page, an
 * entry point of its own — and a link to one of them is not a route, it is a
 * page load. The address does not say which of the two it is, and guessing
 * would be worse than not knowing: "no route matches, so it must be another
 * document" turns a typo'd in-app url into a silent reload of the app instead
 * of its own not-found screen. So the link says it.
 *
 * `<Link document>` / `<Button document>` is that, and the point of saying it
 * on a link rather than navigating from an action is everything a link is: an
 * address in the status bar, a middle click, "open in new tab", something for
 * assistive technology to read. Only the interception steps aside; the element
 * stays a real link and the browser loads the page.
 *
 * It travels as an attribute for the same reason `replace` does (see
 * link_replace.js): whoever answers the press sees the element, not the
 * component that rendered it.
 */

export const LINK_DOCUMENT_ATTRIBUTE = "data-navi-document";

export const linkAsksForDocument = (linkElement) => {
  return linkElement.hasAttribute(LINK_DOCUMENT_ATTRIBUTE);
};
