import { createContext } from "preact";

/**
 * What a <Link> learns from the <Nav> around it: where to draw the bar that
 * says "you are here", and — for a row of tabs that are slides — which
 * <SlideContainer> they are about and which of its slides is on screen (see
 * nav.jsx).
 */
export const NavContext = createContext(null);
