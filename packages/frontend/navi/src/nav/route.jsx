/**
 * Route is the single primitive for URL-based rendering.
 *
 * ## Layout pattern
 * Use this when multiple routes share a common layout but have no shared URL prefix,
 * making it impossible to set a guard route on the parent container.
 * For example, `/profile` and `/settings` both live inside `AuthLayout` but there
 * is no `/auth/` prefix to match on. A container Route wraps them: the active
 * child's element is injected as `children` into the layout element.
 * If a page needs state owned by the layout, the layout must expose it via context.
 *
 * ```jsx
 * const PROFILE_ROUTE = route("/profile");
 * const SETTINGS_ROUTE = route("/settings");
 *
 * <Route element={AuthLayout}>
 *   <Route route={PROFILE_ROUTE} element={ProfilePage} />
 *   <Route route={SETTINGS_ROUTE} element={SettingsPage} />
 *   <Route fallback element={AuthNotFoundPage} />
 * </Route>
 * ```
 *
 * ## Self-contained section pattern
 * Use this when routes share a common URL prefix (e.g. `/dashboard/`).
 * A single leaf Route in the top-level router matches the prefix; the component
 * it renders owns its sub-router and all related routes internally.
 * Everything about the section — routes, structure, sub-pages — is co-located.
 * The component is not a reusable layout; it is the section.
 *
 * Compared to the layout pattern, a dedicated section component is more powerful:
 * - Wrapper elements (chrome, nav, containers) are part of the component's render,
 *   not injected via `children`, so a layout is not needed.
 * - Local state can be passed directly via `elementProps` to sub-pages. With the
 *   layout pattern, sub-pages receive state only through `children` or context.
 *
 * The layout pattern remains necessary when a shared prefix does not exist
 * (see "Layout pattern" above).
 *
 * ```jsx
 * const DASHBOARD_SECTION_ROUTE = route("/dashboard/");
 * const DASHBOARD_HOME_ROUTE = route("/dashboard");
 * const DASHBOARD_POSTS_ROUTE = route("/dashboard/posts");
 *
 * // top-level router — only knows about the prefix
 * <Route route={DASHBOARD_SECTION_ROUTE} element={DashboardSection} />
 *
 * // Dashboard owns the rest
 * const DashboardSection = () => {
 *  const [sidebarOpen, setSidebarOpen] = useState(false);
 *
 *   return <div
 *     style="background: lightblue; padding: 10px;"
 *     onClick={() => setSidebarOpen(o => !o)}
 *   >
 *     <Route>
 *       <Route route={DASHBOARD_HOME_ROUTE} element={DashboardHomePage} elementProps={{ sidebarOpen}} />
 *       <Route route={DASHBOARD_POSTS_ROUTE} element={DashboardPostsPage} elementProps={{ sidebarOpen }} />
 *       <Route fallback element={DashboardNotFound} />
 *     </Route>
 *   </div>;
 * }
 * ```
 */

import { signal } from "@preact/signals";
import { cloneElement, h } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

import { useUITransitionContentId } from "../transition/ui_transition.jsx";
import { observeRouteRender, publishRouteRender } from "./route_render.js";

export { observeRouteRender };

/**
 * Keep every container showing the page it is showing, whatever the routes say.
 *
 * For a caller whose picture of a page is LIVE and must not follow the router:
 * a travel being undone shows the page it is going back to on both sides at
 * once if the router is allowed to swap under it (see route_travel.jsx). Only
 * the pages are held still — the rest of the document goes on rendering, which
 * is the whole reason this lives here rather than in Preact's own scheduler.
 */
let routeRenderFrozen = false;
const routeRenderFrozenSignal = signal(0);
export const freezeRouteRender = () => {
  routeRenderFrozen = true;
  return () => {
    if (!routeRenderFrozen) {
      return;
    }
    routeRenderFrozen = false;
    // Read during every container's render, so letting go brings them all back.
    routeRenderFrozenSignal.value++;
  };
};

const DEBUG = false;
const debug = (...args) => {
  if (!DEBUG) {
    return;
  }
  console.debug(...args);
};

/**
 * Dispatches on its props:
 * - children → RouteContainer (traverses children statically, renders active branch)
 * - route    → RouteLeafRoute (rendered by parent container when URL matches)
 * - fallback → RouteActive (rendered by parent container when no sibling matches)
 *
 * @param {object} props
 * @param {object} [props.route] - the route this branch is for, from `route()`
 * @param {object} [props.routeParams] - selects a branch on a param of that route
 * @param {boolean} [props.fallback] - the branch taken when no sibling matches
 * @param {Function|import("preact").VNode} [props.element] - what the branch renders
 * @param {object} [props.elementProps] - props given to `element`
 *
 * A branch says what it renders, not what happens when it cannot: loading and
 * error states are delegated to `<Loading>` and `<ErrorBoundary>` ancestors,
 * which may be written between routes (a container reads through them, see
 * collectBranches).
 */
export const Route = (props) => {
  if (props.children) {
    return <RouteContainer {...props} />;
  }
  return <RouteLeaf {...props} />;
};
/**
 * The pages a tree of <Route> children is made of, in the order they are
 * written. Reading them is what turns a router into a row one can walk: "one
 * step that way" is a fact about the order the branches were declared in, and
 * nothing in a URL says it.
 *
 * A page is `{ route, params }`, never the route alone: a section of a page is
 * as often a PARAM as it is a route of its own — `<Route route={PAGE}
 * routeParams={{ section: "done" }}>` is how this very file selects a branch on
 * one — and three branches of the same route are then the same object three
 * times. Told apart by their params, they are three pages one walks between;
 * told apart by identity, they are one page and there is nowhere to walk.
 * `params` is undefined for a branch that is a route on its own.
 *
 * The same walk the container does to find the active branch (collectBranches),
 * except that it keeps every leaf rather than the one that matches — and reads
 * no signal, so asking does not subscribe the asker to anything.
 */
export const collectRoutePages = (children) => {
  const pages = [];
  const visit = (child) => {
    if (!child || child === true || child === false) {
      return;
    }
    if (Array.isArray(child)) {
      for (const item of child) {
        visit(item);
      }
      return;
    }
    if (child.type !== Route) {
      // Something written between routes — <Loading>, <ErrorBoundary>, a box of
      // the app's own. The pages are inside it (see collectBranches).
      visit(child.props && child.props.children);
      return;
    }
    const { children: nodeChildren, route, routeParams } = child.props;
    if (nodeChildren) {
      visit(nodeChildren);
      return;
    }
    if (route) {
      pages.push({ route, params: routeParams });
    }
  };
  visit(children);
  return pages;
};

// RouteContainer: traverses children statically per render, finds the active branch,
// and renders only that branch — or the fallback if nothing matches.
// No contexts, no state of its own: it reads the route signals directly, and
// its one effect only tells the outside what it has just done.
const RouteContainer = ({ id, element, elementProps, children }) => {
  const { activeBranch } = collectBranches(children);

  // Told to hold still: what is on screen stays on screen. Kept as the very
  // vnode that was rendered last time, which is how Preact is told there is
  // nothing to look at in that subtree.
  const frozen = routeRenderFrozenSignal.value >= 0 && routeRenderFrozen;
  const shownBranchRef = useRef(null);
  if (!frozen) {
    shownBranchRef.current = activeBranch;
  }
  const branch = shownBranchRef.current || activeBranch;

  // The one effect here, and it says the only thing this component knows that
  // nobody outside can find out: the branch it chose is now in the DOM.
  useLayoutEffect(() => {
    publishRouteRender();
  });

  debug(`[container "${id}"] RENDER, active=${branch ? branch.type : "none"}`);

  const content = branch ? branch.node : null;
  if (!content) {
    return null;
  }
  if (element) {
    return h(element, elementProps, content);
  }
  return content;
};
// Walk JSX children vnodes (without rendering) to build a branch list and
// find the active one in the same pass. Anything that is not a <Route> is read
// through and kept around the branch it holds (see below).
// Returns { matchingBranch, fallbackBranch, activeBranch }.
const collectBranches = (children) => {
  let matchingBranch = null;
  let fallbackBranch = null;

  const visit = (child) => {
    if (!child || child === true || child === false) {
      return;
    }
    if (Array.isArray(child)) {
      for (const item of child) {
        visit(item);
      }
      return;
    }
    if (child.type !== Route) {
      // Anything else is a wrapper around branches, and the two that matter are
      // navi's own: a page says what it renders and delegates what it cannot —
      // loading to <Loading>, failing to <ErrorBoundary> — so those are written
      // BETWEEN the container and its routes. Reading through them is what lets
      // a subtree of pages share one, instead of the router demanding that its
      // children be routes and pushing every boundary outside of it.
      //
      // The wrapper is kept around whatever it holds: the container renders the
      // active branch alone, so the branch has to carry the wrapper with it, or
      // being selected would mean losing what was written around it.
      const wrapperChildren = child.props && child.props.children;
      if (!wrapperChildren) {
        throw new Error(
          `A <Route> child must be a <Route>, or hold some: ${String(child.type?.name ?? child.type)} holds nothing.`,
        );
      }
      const { matchingBranch: matchingInside, fallbackBranch: fallbackInside } =
        collectBranches(wrapperChildren);
      if (matchingInside && !matchingBranch) {
        matchingBranch = wrapBranch(matchingInside, child);
      }
      if (fallbackInside && !fallbackBranch) {
        fallbackBranch = wrapBranch(fallbackInside, child);
      }
      return;
    }
    const {
      children: nodeChildren,
      fallback,
      route,
      routeParams,
    } = child.props;
    if (nodeChildren) {
      const { matchingBranch: matchingChild } = collectBranches(nodeChildren);
      const branch = { type: "container", node: child };
      const guardMatching = route ? route.matchingSignal.value : false;
      if (!matchingBranch) {
        if (matchingChild) {
          // Real leaf match inside — always select this container
          matchingBranch = branch;
        } else if (guardMatching) {
          // No leaf match but an explicit route guard matches — select this
          // container so it can render its own fallback inside its layout
          matchingBranch = branch;
        }
      }
    } else if (fallback) {
      if (!fallbackBranch) {
        fallbackBranch = { type: "fallback", node: child };
      }
    } else {
      const branch = { type: "leaf", node: child };
      // every signal is read even once a match is found: reading is what
      // subscribes the container to it, and a branch that is skipped today is
      // the one that must wake the container up tomorrow
      const matching = route.matchingSignal.value;
      const paramsMatching = routeParams
        ? route.matchesParams(routeParams)
        : true;
      if (!matchingBranch && matching && paramsMatching) {
        matchingBranch = branch;
      }
    }
  };

  visit(children);
  const activeBranch = matchingBranch || fallbackBranch || null;
  return { matchingBranch, fallbackBranch, activeBranch };
};
const wrapBranch = (branch, wrapper) => {
  return {
    ...branch,
    node: cloneElement(wrapper, null, branch.node),
  };
};
const RouteLeaf = (props) => {
  if (props.route) {
    return <RouteLeafRoute {...props} />;
  }
  if (props.fallback) {
    return <RouteLeafFallback {...props} />;
  }
  // not supposed to happen?
  return <RouteUI {...props} />;
};
const RouteLeafRoute = (props) => {
  useUITransitionContentId(props.route?.urlPattern);
  return <RouteUI {...props} />;
};
const RouteLeafFallback = (props) => {
  return <RouteUI {...props} />;
};
const RouteUI = ({ element, elementProps }) => {
  if (typeof element === "function") {
    return h(element, elementProps);
  }
  return element;
};
