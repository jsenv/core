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
  // --- permissionsRequired: [] (empty = anyone) ---

  test("permissionsRequired empty allows unauthenticated request", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: [],
          fetch: () => new Response("ok"),
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status, body: await response.text() };
  });

  // --- permissionsRequired without grantPermissions plugin → denied (404) ---

  test("permissionsRequired without grantPermissions plugin returns 404", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: ["admin"],
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
          permissionsRequired: ["admin"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => ["admin"],
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
          permissionsRequired: ["admin"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access denied, no permissionsToSee → 404 ---

  test("access denied without permissionsToSee returns 404", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: ["admin"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access denied, permissionsToSee: [] → 403 ---

  test("access denied with permissionsToSee empty returns 403", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: ["admin"],
          permissionsToSee: [],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access denied, permissionsToSee not satisfied → 404 ---

  test("access denied with permissionsToSee not satisfied returns 404", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: ["admin"],
          permissionsToSee: ["superuser"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- access denied, permissionsToSee satisfied → 403 ---

  test("access denied with permissionsToSee satisfied returns 403", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: ["admin"],
          permissionsToSee: ["user"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => ["user"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- permissionsRequired array: all permissions required ---

  test("permissionsRequired array granted when all permissions present", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: ["read", "write"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => ["read", "write"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status, body: await response.text() };
  });

  test("permissionsRequired array denied when only one permission present", async () => {
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: ["read", "write"],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => ["read"],
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status };
  });

  // --- grantPermissions called once per request (memoization) ---

  test("grantPermissions plugin called once per request", async () => {
    let callCount = 0;
    const server = await startPermissionsServer({
      routes: [
        {
          endpoint: "GET /",
          permissionsRequired: ["admin"],
          permissionsToSee: [],
          fetch: () => new Response("ok"),
        },
      ],
      plugins: [
        {
          name: "test:permissions",
          grantPermissions: () => {
            callCount++;
            return ["user"];
          },
        },
      ],
    });
    const response = await fetch(server.origin);
    return { status: response.status, grantPermissionsCallCount: callCount };
  });
});
