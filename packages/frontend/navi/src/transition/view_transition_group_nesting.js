/**
 * Nested view transition groups: what they are for, and why a browser without
 * them gets no transition at all.
 *
 * The pictures a view transition takes are drawn in the top layer, side by side
 * under `::view-transition` — a flat tree that has forgotten which element was
 * inside which. No `overflow` in the document reaches them, so a row leaving a
 * scrolling box is seen crossing the page beside it.
 *
 * `view-transition-group: contain` on the box puts the pictures of everything
 * named inside it back inside its own picture, and
 * `::view-transition-group-children(name)` is then the box's edge: told to clip,
 * it cuts the rows exactly where the box does the rest of the time.
 *
 * Where a movement is only correct BECAUSE of that clipping — a list whose rows
 * travel, a container whose pages slide — a browser without nesting must not
 * play it: what it would show is not a lesser animation, it is content flying
 * across the page. Guard the naming (or the call itself) with
 * `canNestViewTransitionGroups` and the change simply happens.
 */
export const canNestViewTransitionGroups =
  typeof CSS !== "undefined" &&
  CSS.supports &&
  CSS.supports("view-transition-group", "contain");
