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

### 2. **Définition centralisée des routes**

Toutes les routes doivent être définies en une seule fois pour que le système de routing puisse fonctionner correctement (matching d'URL, navigation, etc.). En se contentant de définir des routes, on obtient :

1. **Une vision épurée de la totalité des routes** - Toutes les routes de l'application sont visibles d'un coup d'œil sans bruit superflu

2. **Utilisation en dehors de l'UI** - Les objets routes peuvent être utilisés partout dans l'application :

```jsx
// Navigation programmatique
import { LOGIN_ROUTE, PROFILE_ROUTE } from "./routes.js";

// Redirection après login
const redirectAfterLogin = () => {
  window.location.href = PROFILE_ROUTE.buildUrl({ userId: "123" });
};

// Construction d'URLs pour des liens
const shareProfileLink = (userId) => {
  return PROFILE_ROUTE.buildUrl({ userId });
};

// Validation de routes dans du code métier
const isUserOnAuthPage = (currentUrl) => {
  return LOGIN_ROUTE.matches(currentUrl);
};
```

Les routes peuvent également être associées à de la logique avant même que les composants JSX soient impliqués. Cela permettra d'implémenter du préchargement de composants et de données, des optimisations de performance, etc.

### 1. **Discoverabilité grâce aux exports nommés**

L'utilisation d'exports nommés permet de voir clairement quelles routes chaque fichier utilise :

```jsx
// ✅ On voit clairement quelles routes ce fichier utilise
import { HOME_ROUTE, PROFILE_ROUTE } from "./routes.js";

// ❌ Impossible de savoir quelles routes sont utilisées
import { ROUTES } from "./routes.js";
// ROUTES.home, ROUTES.profile utilisés quelque part...
```
