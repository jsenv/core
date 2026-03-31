/**
 *
 * . Refactor les actions pour qu'elles utilisent use. Ce qui va ouvrir la voie pour
 * Suspense et ErrorBoundary sur tous les composants utilisant des actions
 *
 * . Tester le code splitting avec .lazy + import dynamique
 * pour les elements des routes
 *
 * 3. Ajouter la possibilite d'avoir des
 *  sur les routes
 * Tester juste les data pour commencer
 * On aura ptet besoin d'un useRouteData au lieu de passer par un element qui est une fonction
 * pour que react ne re-render pas tout
 *
 * 4. Utiliser use() pour compar Suspense et ErrorBoundary lorsque route action se produit.
 *
 *
 */

/**
 * Route is the single primitive for URL-based rendering.
 *
 * ## Layout pattern
 * Use this when multiple routes share a common layout but have no shared URL prefix,
 * making it impossible to set a guard route on the parent container.
 * For example, `/profile` and `/settings` both live inside `AuthLayout` but there
 * is no `/auth/` prefix to match on. A container Route wraps them: the active
 * child's element is injected as `children` into the layout element.
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
 * ```jsx
 * const DASHBOARD_SECTION_ROUTE = route("/dashboard/");
 * const DASHBOARD_HOME_ROUTE = route("/dashboard");
 * const DASHBOARD_POSTS_ROUTE = route("/dashboard/posts");
 *
 * // top-level router — only knows about the prefix
 * <Route route={DASHBOARD_SECTION_ROUTE} element={DashboardSection} />
 *
 * // DashboardSection owns the rest
 * const DashboardSection = () => {
 *   return <div style="background: lightblue; padding: 10px;">
 *     <Route>
 *       <Route route={DASHBOARD_HOME_ROUTE} element={DashboardHomePage} />
 *       <Route route={DASHBOARD_POSTS_ROUTE} element={DashboardPostsPage} />
 *       <Route fallback element={DashboardNotFound} />
 *     </Route>
 *   </div>;
 * }
 * ```
 */

import { ActionRenderer } from "../action/action_renderer.jsx";
import { useUITransitionContentId } from "../ui_transition/ui_transition.jsx";

const DEBUG = true;
const debug = (...args) => {
  if (!DEBUG) {
    return;
  }
  console.debug(...args);
};

// <Route> dispatches based on props:
// - children → RouteContainer (traverses children statically, renders active branch)
// - route    → RouteLeafRoute (rendered by parent container when URL matches)
// - fallback → RouteActive (rendered by parent container when no sibling matches)
export const Route = (props) => {
  if (props.children) return <RouteContainer {...props} />;
  return <RouteLeaf {...props} />;
};

// Walk JSX children vnodes (without rendering) to build a branch list and
// find the active one in the same pass.
// All children must be <Route> — throws in dev otherwise.
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
      throw new Error(
        `All <Route> children must be <Route> nodes, got: ${String(child.type?.name ?? child.type)}`,
      );
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
      if (!matchingBranch) {
        if (matchingChild) {
          // Real leaf match inside — always select this container
          matchingBranch = branch;
        } else if (route && route.matchingSignal.value) {
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
      if (
        !matchingBranch &&
        route.matchingSignal.value &&
        (!routeParams || route.matchesParams(routeParams))
      ) {
        matchingBranch = branch;
      }
    }
  };

  visit(children);
  const activeBranch = matchingBranch || fallbackBranch || null;
  return { matchingBranch, fallbackBranch, activeBranch };
};
// RouteContainer: traverses children statically per render, finds the active branch,
// and renders only that branch — or the fallback if nothing matches.
// No effects, no signals, no contexts needed: reads route signals directly.
const RouteContainer = ({ id, element, elementProps, children }) => {
  const { activeBranch } = collectBranches(children);

  debug(
    `[container "${id}"] RENDER, active=${activeBranch ? activeBranch.type : "none"}`,
  );

  const content = activeBranch ? activeBranch.node : null;

  if (!content) {
    return null;
  }
  if (element) {
    const Element = element;
    return <Element {...elementProps}>{content}</Element>;
  }
  return content;
};

const RouteLeaf = (props) => {
  if (props.route) return <RouteLeafRoute {...props} />;
  if (props.fallback) return <RouteLeafFallback {...props} />;
  // not supposed to happen?
  return <RouteActive {...props} />;
};
const RouteLeafRoute = (props) => {
  useUITransitionContentId(props.route?.urlPattern);
  return <RouteActive {...props} />;
};
const RouteLeafFallback = (props) => {
  return <RouteActive {...props} />;
};
const RouteActive = ({ element, elementProps, action }) => {
  const Element = element;
  const renderedElement = action ? (
    <ActionRenderer action={action}>{element}</ActionRenderer>
  ) : typeof element === "function" ? (
    <Element {...elementProps} />
  ) : (
    element
  );
  return renderedElement;
};
