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
        `All <Route> children must be <Route> components, got: ${String(child.type)}`,
      );
    }
    const {
      children: nodeChildren,
      fallback,
      route,
      routeParams,
    } = child.props;
    if (nodeChildren) {
      const { activeBranch: activeChild } = collectBranches(nodeChildren);
      const branch = { type: "container", node: child };
      if (!matchingBranch && activeChild) {
        matchingBranch = branch;
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
