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
  if (props.route) return <RouteLeafRoute {...props} />;
  if (props.fallback) return <RouteActive {...props} />;
  return null;
};

// Walk JSX children vnodes (without rendering) to build a descriptor list and
// find the active one in the same pass.
// All children must be <Route> — throws in dev otherwise.
// Returns { descriptors, activeDescriptor }.
const collectDescriptors = (children) => {
  const descriptors = [];
  let activeDescriptor = null;

  const visit = (child) => {
    if (!child || child === true || child === false) return;
    if (Array.isArray(child)) {
      for (const item of child) visit(item);
      return;
    }
    if (import.meta.dev && child.type !== Route) {
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
      const { activeDescriptor: activeChild } =
        collectDescriptors(nodeChildren);
      const descriptor = { type: "container", node: child };
      descriptors.push(descriptor);
      if (!activeDescriptor && activeChild) activeDescriptor = descriptor;
    } else if (fallback) {
      descriptors.push({ type: "fallback", node: child });
    } else {
      const descriptor = { type: "leaf", node: child };
      descriptors.push(descriptor);
      if (
        !activeDescriptor &&
        route.matchingSignal.value &&
        (!routeParams || route.matchesParams(routeParams))
      ) {
        activeDescriptor = descriptor;
      }
    }
  };

  visit(children);
  return { descriptors, activeDescriptor };
};
// RouteContainer: traverses children statically per render, finds the active branch,
// and renders only that branch — or the fallback if nothing matches.
// No effects, no signals, no contexts needed: reads route signals directly.
const RouteContainer = ({ id, element, elementProps, children }) => {
  const { descriptors, activeDescriptor } = collectDescriptors(children);

  debug(
    `[container "${id}"] RENDER, active=${activeDescriptor ? activeDescriptor.type : "none"}`,
  );

  let content;
  if (activeDescriptor) {
    content = activeDescriptor.node;
  } else {
    const fallbackDescriptor = descriptors.find((d) => d.type === "fallback");
    content = fallbackDescriptor ? fallbackDescriptor.node : null;
  }

  if (!content) return null;

  if (element) {
    const Element = element;
    return <Element {...elementProps}>{content}</Element>;
  }
  return content;
};

// RouteLeafRoute: rendered by parent RouteContainer when this route is active.
const RouteLeafRoute = (props) => {
  useUITransitionContentId(props.route?.urlPattern);
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
