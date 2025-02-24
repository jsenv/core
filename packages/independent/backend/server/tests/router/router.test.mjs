import { createRouter } from "../../src/router/router.js";

{
  const router = createRouter();
  router.add({
    endpoint: "GET /",
    response: () => "hello",
  });
  const result = await router.match({
    resource: "/",
    method: "GET",
  });
  debugger;
}
