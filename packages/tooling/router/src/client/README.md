It works as follow:

- Any route can register a UI **once** as follow

```js
import { registerRoute, Route } from "@jsenv/router";

const userRoute = registerRoute({
  "GET /users/:id": () => {
    const response = await fetch('/users/:id');
    const user = await response.json();
    return user
  },
});

<Route route={userRoute} loaded={MyComponent} />;
```

It will set `<MyComponent />` as the UI for `userRoute`

- Usually PATCH/POST/PUT/DELETE have no UI so they are registered differently

```js
import { registerAction, useAction } from "@jsenv/router";

const deleteUserAction = registerAction(async ({ id }) => {
  await fetch("/users/:id", { method: "DELETE " });
});

// very simple example (usually you would put this in a form)
const DeleteUser = ({ id }) => {
  const deleteUserAction = useAction(deleteUserAction, { id });
  return <button onClick={deleteUserAction}></button>;
};
```

In case you want to display something and remove the rest of the page while an action is performed you can register a UI for an action as follow:

```js
<Route route={deleteUserAction} loaded={MyComponent} />
```

But usually you would just check if the action is hapenning and update UI accordingly

```js
import { useActionStatus, useAction } from "@jsenv/router";

const DeleteUser = ({ id }) => {
  const deleteUserAction = useAction(deleteUserActionRoute, { id });
  const { pending } = useActionStatus(deleteUserAction);
  return <button disabled={pending} onClick={deleteUserAction}></button>;
};
```

## Note to self

Generic GET routes are working fine without having to have X instance per route because
when I click on a route with a UI it gets reloaded even if it's the current route
(do we want this? because it means clicking a link where we already are will reload the page)

I need to recall why we reload the page even if we are already on it. I guess we should not.

Consequently we'll have to implement something looking like the thing for action for get routes
the route needs to be instantiated with params to represent where we are
then we can assume we are on the route or not
