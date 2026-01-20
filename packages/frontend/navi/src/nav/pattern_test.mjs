import { stateSignal } from "../state/state_signal.js";
import { clearAllRoutes, registerRoute } from "./route.js";

console.log("Testing pattern transformations...\n");

// Clear any existing routes
clearAllRoutes();

// Create signals for testing
const sectionSignal = stateSignal("section", { defaultValue: "settings" });
const tabSignal = stateSignal("tab", { defaultValue: "general" });
const analyticsTabSignal = stateSignal("tab", { defaultValue: "overview" });

// Register routes in the order that was causing issues
const routes = [
  registerRoute("/"),
  registerRoute(`/admin/${sectionSignal}/`),
  registerRoute(`/admin/settings/${tabSignal}`),
  registerRoute(`/admin/analytics/?tab=${analyticsTabSignal}`),
];

console.log("Pattern transformations:");
for (let i = 0; i < routes.length; i++) {
  const route = routes[i];
  console.log(`${i + 1}. Original: "${route.urlPattern}"`);
}

console.log("\nTest completed.");
