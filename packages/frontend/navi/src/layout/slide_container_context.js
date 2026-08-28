import { createContext } from "preact";

/**
 * What the container tells what is inside it: which way it travels so a button
 * can point the right way without being told twice, what a travel handed to a
 * slide, and the box itself — which is how a way out written inside reads the
 * same facts a way out written outside reads by id (see useSlideContainer).
 *
 * Its own module, tiny on purpose: the hook that reads a container and the
 * container that fills this in would otherwise have to import each other.
 */
export const SlideContainerContext = createContext(null);
