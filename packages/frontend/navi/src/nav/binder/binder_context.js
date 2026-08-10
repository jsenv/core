import { createContext } from "preact";

/**
 * What a binder tab hands to whatever it contains: a way to say "I am the
 * current one". A `Link` inside a tab knows it is current (its route matches)
 * long before the binder could work it out, so it reports instead of the
 * binder guessing — see `Link`'s use of this context.
 *
 * Its own module so `link.jsx` can read it without importing the binder.
 *
 * @type {import("preact").Context<{ reportCurrent: (current: boolean) => void } | null>}
 */
export const BinderItemContext = createContext(null);
