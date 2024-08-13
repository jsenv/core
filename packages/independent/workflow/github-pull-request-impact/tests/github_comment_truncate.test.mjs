import { assert } from "@jsenv/assert";
import { createGitHubPullRequestCommentText } from "@jsenv/github-pull-request-impact/src/internal/create_github_pull_request_comment_text.js";

{
  const actual = createGitHubPullRequestCommentText({
    header: "header",
    warnings: ["warning message"],
    body: "body",
    footer: "footer",
  });
  const expect = `header

---

warning message

---

body

footer`;
  assert({ actual, expect });
}

{
  const message = createGitHubPullRequestCommentText({
    header: "header",
    warnings: ["warning message"],
    body: `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.`,
    footer: "footer",
    maxLength: 300,
  });
  const actual = {
    message,
    messageLength: Buffer.byteLength(message),
  };
  const expect = {
    message: `header

---

warning message

**Warning:** The comment body was truncated to fit GitHub limit on comment length.
As the body is truncated the message might be hard to read.
For the record the full comment length was 488 bytes.

---

Lorem ipsum dolor sit amet, consectetur adipiscing elit,…

footer`,
    messageLength: 300,
  };
  assert({ actual, expect });
}
