/*
 * A push to another page is an arrival: the page opens at its top and its
 * lists forget where they were (see startAtTop, forgetScrollersOnArrival). Some
 * pushes are returns by meaning — the entry of a bottom bar leading back to a
 * thread whose address names the item one was reading — and the address alone
 * cannot say so: the same push from a link to that item elsewhere is an
 * arrival. So the link says it, and the page comes back where its address was
 * last left, as a back would have brought it.
 *
 * `<Link asReturn>`, or `navTo(url, { asReturn: true })`. It travels as an
 * attribute for the same reason as `replace` (see link_replace.js): whoever
 * answers the press sees the element, not the component that rendered it.
 */

export const LINK_RETURN_ATTRIBUTE = "data-navi-as-return";

export const linkAsksForReturn = (linkElement) => {
  return linkElement.hasAttribute(LINK_RETURN_ATTRIBUTE);
};
