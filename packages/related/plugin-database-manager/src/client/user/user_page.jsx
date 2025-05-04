import { Route } from "@jsenv/router";
import { GET_USER_ROUTE } from "./user_routes.js";

export const UserRoutes = () => {
  return <Route route={GET_USER_ROUTE} loaded={UserPage} />;
};

const UserPage = ({ route }) => {
  const user = route.data;
  return JSON.stringify(user);
};
