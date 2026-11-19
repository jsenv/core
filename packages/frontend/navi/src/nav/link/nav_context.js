import { createContext } from "preact";

/**
 * What a <Link> learns from the <Nav> around it: where to draw the bar that
 * says "you are here" (the edge, resolved by the row for all its tabs), and —
 * for a row of tabs that are slides — which <SlideContainer> they are about
 * and which of its slides is on screen. And the one thing a tab says back:
 * `tabCurrentChanged()`, when it becomes or stops being the current one (see
 * nav.jsx).
 */
export const NavContext = createContext(null);
