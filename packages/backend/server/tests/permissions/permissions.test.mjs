import { startServer } from "@jsenv/server";
import { snapshotServerTests } from "@jsenv/server/tests/test_helpers.mjs";

const startPermissionsServer = async ({ routes, plugins = [] }) => {
  return startServer({
    logLevel: "warn",
    keepProcessAlive: false,
    routes,
    plugins,
  });
};

await snapshotServerTests(import.meta.url, ({ test }) => {
  // --- access: "all" ---

  test("access all allows unauthenticated request", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "all",
          fetch: () => new Response("ok"),
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status, body: await response.text() };
  });

  // --- access without permission plugin → denied (404) ---

  test("access string without getPermissions plugin returns 404", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "admin",
          fetch: () => new Response("ok"),
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access granted by plugin ---

  test("access granted when plugin returns matching permission", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "admin",
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => ["admin"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status, body: await response.text() };
  });

  // --- access denied by plugin (wrong permission) ---

  test("access denied when plugin returns wrong permission", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "admin",
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access denied, no visible → 404 ---

  test("access denied without visible returns 404", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "admin",
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access denied, visible: "all" → 403 ---

  test("access denied with visible all returns 403", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "admin",
          visible: "all",
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access denied, visible permission not satisfied → 404 ---

  test("access denied with visible permission not satisfied returns 404", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "admin",
          visible: "superuser",
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access denied, visible permission satisfied → 403 ---

  test("access denied with visible permission satisfied returns 403", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "admin",
          visible: "user",
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access array: all permissions required ---

  test("access array granted when all permissions present", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: ["read", "write"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => ["read", "write"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status, body: await response.text() };
  });

  test("access array denied when only one permission present", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: ["read", "write"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => ["read"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- getPermissions called once per request (memoization) ---

  test("getPermissions plugin called once per request", async () => {
    let callCount = 0;
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          access: "admin",
          visible: "all",
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          getPermissions: () => {
            callCount++;
            return ["user"];
          },
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status, getPermissionsCallCount: callCount };
  });
});
