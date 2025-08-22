import { useRouteStatus } from "../route/route.js";
import { ActionRenderer } from "./action_renderer.jsx";
import { useContentKey } from "./ui_transition.jsx";

export const Route = ({ route, children }) => {
  if (!route.action) {
    throw new Error(
      "Route component requires a route with an action to render.",
    );
  }
  const { active, url } = useRouteStatus(route);
  useContentKey(url, active);
  console.log(url, active);

  return (
    <ActionRenderer disabled={!active} action={route.action}>
      {children}
    </ActionRenderer>
  );
};
