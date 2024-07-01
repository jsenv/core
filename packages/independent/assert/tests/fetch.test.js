// https://developer.mozilla.org/en-US/docs/Web/API/Request/Request

import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("fetch", ({ test }) => {
  test("abort signal pending vs aborted", () => {
    const expectAbortController = new AbortController();
    expectAbortController.abort("toto");
    assert({
      actual: new AbortController().signal,
      expect: expectAbortController.signal,
    });
  });
  test("request url diff", () => {
    assert({
      actual: new Request("https://foo.com"),
      expect: new Request("https://bar.com"),
    });
  });
  test("request with custom options", () => {
    assert({
      actual: new Request("http://example.com", {
        cache: "default",
        credentials: "same-origin",
        destination: "",
        method: "GET",
        mode: "cors",
        priority: "auto",
        redirect: "follow",
        referrerPolicy: "",
        referrer: "about:client",
      }),
      expect: new Request("http://example.com", {
        body: '{"foo": "bar"}',
        cache: "no-store",
        credentials: "omit",
        destination: "document",
        headers: { from: "developer@example.org" },
        method: "POST",
        mode: "same-origin",
        priority: "high",
        redirect: "manual",
        referrerPolicy: "strict-origin",
        referrer: "http://google.com",
      }),
      MAX_CONTEXT_AFTER_DIFF: 10,
      MAX_CONTEXT_BEFORE_DIFF: 10,
      MAX_DEPTH_INSIDE_DIFF: 5,
    });
  });
  test("request abort signal pending vs aborted", () => {
    const expectAbortController = new AbortController();
    expectAbortController.abort("toto");
    assert({
      actual: new Request("http://example.com", {
        signal: new AbortController().signal,
      }),
      expect: new Request("http://example.com", {
        signal: expectAbortController.signal,
      }),
    });
  });
  test("response body diff", () => {
    assert({
      actual: {
        a: new Response("foo"),
        b: true,
      },
      expect: {
        a: new Response("bar"),
        b: false,
      },
    });
  });
  test("response status diff", () => {
    assert({
      actual: new Response("", {
        status: 200,
      }),
      expect: new Response("", {
        status: 400,
      }),
    });
  });
  test("response prop diff", () => {
    assert({
      actual: new Response("", {
        status: 200,
        statusText: "",
        type: "basic",
      }),
      expect: new Response("", {
        status: 400,
        statusText: "Bad request",
        headers: {
          "content-length": "0",
        },
        type: "opaque",
      }),
      MAX_CONTEXT_BEFORE_DIFF: 8,
      MAX_CONTEXT_AFTER_DIFF: 8,
    });
  });
  test("redirected response", () => {
    assert({
      actual: new Response("", { status: 200 }),
      expect: Response.redirect("http://example.com"),
    });
  });
});
