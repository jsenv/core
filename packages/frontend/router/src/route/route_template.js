import { compareTwoJsValues } from "../compare_two_js_values.js";
import { registerRoute } from "./route.js";

export const createRouteTemplate = (routeBuilder) => {
  const cachedRoutes = [];
  const routeParamsMap = new WeakMap(); // Stockage séparé des paramètres

  const instantiate = (params) => {
    // Nettoyer les WeakRef mortes et chercher une correspondance
    const liveRoutes = cachedRoutes.filter((ref) => ref.deref() !== undefined);
    cachedRoutes.length = 0;
    cachedRoutes.push(...liveRoutes);

    // Chercher une route existante avec les mêmes paramètres
    for (const routeRef of cachedRoutes) {
      const cachedRoute = routeRef.deref();
      if (cachedRoute) {
        const cachedParams = routeParamsMap.get(cachedRoute);
        if (compareTwoJsValues(cachedParams, params)) {
          return cachedRoute;
        }
      }
    }

    // Créer une nouvelle route avec les paramètres
    const routeBuilderResult = routeBuilder(params);
    const route = registerRoute(routeBuilderResult);

    // Stocker les paramètres dans la WeakMap séparée
    routeParamsMap.set(route, params);

    // Stocker une WeakRef vers la route
    cachedRoutes.push(new WeakRef(route));

    return route;
  };

  return { instantiate };
};
