// Quick test for the new createSubRoute functionality
import { defineRoutes } from "./packages/frontend/navi/src/route/route.js";

// Test the new sub-route functionality
const [USER_ROUTE] = defineRoutes({
  "/users/:username/*?": () => {},
});

// Create sub-routes using the new createSubRoute method
const USER_SETTINGS_ROUTE = USER_ROUTE.createSubRoute("/settings");
const USER_PROFILE_ROUTE = USER_ROUTE.createSubRoute("/profile");
const USER_ROOT_ROUTE = USER_ROUTE.createSubRoute("/");

console.log("🎯 Route Pattern Tests:");
console.log("Parent route:", USER_ROUTE.toString());
console.log("Settings sub-route:", USER_SETTINGS_ROUTE.toString());
console.log("Profile sub-route:", USER_PROFILE_ROUTE.toString());
console.log("Root sub-route:", USER_ROOT_ROUTE.toString());

console.log("\n🔗 URL Building Tests:");
const testParams = { username: "john" };
console.log("Parent route URL:", USER_ROUTE.buildUrl(testParams));
console.log("Settings URL:", USER_SETTINGS_ROUTE.buildUrl(testParams));
console.log("Profile URL:", USER_PROFILE_ROUTE.buildUrl(testParams));
console.log("Root URL:", USER_ROOT_ROUTE.buildUrl(testParams));

console.log("\n✅ Expected behavior:");
console.log("- USER_SETTINGS_ROUTE should match '/users/john/settings'");
console.log("- USER_PROFILE_ROUTE should match '/users/john/profile'");
console.log("- USER_ROOT_ROUTE should match '/users/john' and '/users/john/'");
console.log("- Parent route can still match '/users/john/anything/else'");
