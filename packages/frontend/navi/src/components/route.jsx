import { useRouteStatus } from "../route/route.js";
import { ActionRenderer } from "./action_renderer.jsx";

export const Route = ({ route, children }) => {
  if (!route.action) {
    throw new Error(
      "Route component requires a route with an action to render.",
    );
  }
  const { active } = useRouteStatus(route);

  return active ? (
    <ActionRenderer action={route.action}>{children}</ActionRenderer>
  ) : null;
};
