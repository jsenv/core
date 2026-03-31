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

import { createContext } from "preact";
import { useContext } from "preact/hooks";

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

// Flatten JSX children to a plain array, filtering nulls/booleans.
const flattenChildren = (children) => {
  if (!children) return [];
  const arr = Array.isArray(children) ? children : [children];
  return arr.flat(Infinity).filter(Boolean);
};

// Walk JSX children vnodes (without rendering) to categorize them.
// All children must be <Route> — throws in dev otherwise.
const collectDescriptors = (children) => {
  const nodes = flattenChildren(children);
  return nodes.map((node) => {
    if (import.meta.dev && node.type !== Route) {
      throw new Error(
        `All <Route> children must be <Route> components, got: ${String(node.type)}`,
      );
    }
    const { children: nodeChildren, fallback } = node.props;
    if (nodeChildren) return { type: "container", node };
    if (fallback) return { type: "fallback", node };
    return { type: "leaf", node };
  });
};

// Check whether any leaf route inside a container's subtree is currently matching.
// Reads matchingSignal.value directly — auto-subscribes via @preact/signals reactivity.
const isContainerActive = (children) => {
  for (const descriptor of collectDescriptors(children)) {
    if (descriptor.type === "leaf") {
      const { route, routeParams } = descriptor.node.props;
      if (
        route.matchingSignal.value &&
        (!routeParams || route.matchesParams(routeParams))
      ) {
        return true;
      }
    }
    if (
      descriptor.type === "container" &&
      isContainerActive(descriptor.node.props.children)
    ) {
      return true;
    }
  }
  return false;
};

// Find the first active descriptor among direct children.
const findActiveDescriptor = (descriptors) => {
  for (const descriptor of descriptors) {
    if (descriptor.type === "leaf") {
      const { route, routeParams } = descriptor.node.props;
      if (
        route.matchingSignal.value &&
        (!routeParams || route.matchesParams(routeParams))
      ) {
        return descriptor;
      }
    }
    if (
      descriptor.type === "container" &&
      isContainerActive(descriptor.node.props.children)
    ) {
      return descriptor;
    }
  }
  return null;
};
// RouteContainer: traverses children statically per render, finds the active branch,
// and renders only that branch — or the fallback if nothing matches.
// No effects, no signals, no contexts needed: reads route signals directly.
const RouteContainer = ({ id, element, elementProps, children }) => {
  const descriptors = collectDescriptors(children);
  const activeDescriptor = findActiveDescriptor(descriptors);

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

const RouteInfoContext = createContext(null);
const RouteActive = ({ route, element, elementProps, action, meta }) => {
  const Element = element;
  const renderedElement = action ? (
    <ActionRenderer action={action}>{element}</ActionRenderer>
  ) : typeof element === "function" ? (
    <Element {...elementProps} />
  ) : (
    element
  );
  return (
    <RouteInfoContext.Provider value={{ route, meta }}>
      {renderedElement}
    </RouteInfoContext.Provider>
  );
};

export const useMatchingRouteInfo = () => {
  return useContext(RouteInfoContext);
};
