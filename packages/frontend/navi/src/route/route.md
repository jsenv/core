# Routes API

## Vue d'ensemble

L'API de routing se divise en deux parties distinctes :

1. **`setupRoutes()`** - Définit toutes les routes de l'application
2. **`<Route>`** - Utilise les routes pour afficher du contenu conditionnel

```jsx
// 1. Definition des routes (généralement dans routes.js)
import { setupRoutes } from "@jsenv/navi";

export const {
  HOME_ROUTE,
  AUTH_ROUTE,
  LOGIN_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  ONE_MORE_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "/",
  AUTH_ROUTE: "/auth/",
  LOGIN_ROUTE: "/auth/login",
  FORGOT_PASSWORD_ROUTE: "/auth/forgot_password",

  ONE_MORE_ROUTE: "/one_more/",
});
```

```jsx
// 2. Utilisation des routes (dans les composants)
import { Route } from "@jsenv/navi";
import { HOME_ROUTE, LOGIN_ROUTE, FORGOT_PASSWORD_ROUTE } from "./routes.js";

export const App = () => {
  return (
    <>
      <Route route={HOME_ROUTE}>Homepage</Route>
      <Route>
        <div>
          <Route route={LOGIN_ROUTE}>Login</Route>
          <Route route={FORGOT_PASSWORD_ROUTE}>Forgot password</Route>
        </div>
      </Route>
    </>
  );
};
```

## Pourquoi cette séparation ?

### 1. **Définition centralisée, utilisation distribuée**

- **`setupRoutes()`** : Toutes les routes doivent être définies en une seule fois pour que le système de routing puisse fonctionner correctement (matching d'URL, navigation, etc.)
- **`<Route>`** : Les composants peuvent importer et utiliser uniquement les routes dont ils ont besoin

### 2. **Discoverabilité des dépendances**

```jsx
// ✅ On voit clairement quelles routes ce fichier utilise
import { HOME_ROUTE, PROFILE_ROUTE } from "./routes.js";

// ❌ Impossible de savoir quelles routes sont utilisées
import { ROUTES } from "./routes.js";
// ROUTES.home, ROUTES.profile utilisés quelque part...
```

### 4. **Séparation des responsabilités**

- **Configuration** (setupRoutes) vs **Utilisation** (Route component)
- Les routes peuvent être définies dans un fichier dédié
- Les composants restent focalisés sur leur logique d'affichage
