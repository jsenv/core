/*
 * A press aims at a place; it does not always go one step deeper. A row of tabs
 * is a lateral move — the neighbour is one finger away — so the whole row should
 * weigh one history entry: the arrow at the top and the phone's back button then
 * leave by where the reader came in, and the swipe (which replaces already, see
 * route_travel.jsx) and the press say the same thing.
 *
 * `<Link replace>` is that, and it travels as an attribute because the click
 * handler sees the anchor, not the component that rendered it — the same mouth
 * as what a link asks of a route transition.
 */

export const LINK_REPLACE_ATTRIBUTE = "data-navi-replace";

export const linkAsksForReplace = (linkElement) => {
  return linkElement.hasAttribute(LINK_REPLACE_ATTRIBUTE);
};
