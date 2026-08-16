import { createContext } from "preact";

/**
 * What a <Link> learns from the <Nav> around it: where to draw the bar that
 * says "you are here", and the name under which the browser is to recognise
 * that bar from one page to the next (see nav.jsx).
 */
export const NavContext = createContext(null);
