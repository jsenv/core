await import("./conditions_order/conditions_order.test.mjs");
await import("./exports_and_main/exports_and_main.test.mjs");
await import("./exports_branch/exports_branch.test.mjs");
await import("./imports/imports.test.mjs");
await import("./node_builtin/node_builtin.test.mjs");
await import("./not_found/not_found.test.mjs");
await import("./scoped/scoped.test.mjs");
await import("./self_and_package/self_and_package.test.mjs");
await import("./subpath_exported/subpath_exported.test.mjs");
await import("./workspace/workspace.test.mjs");

console.log(`all tests completed`);
