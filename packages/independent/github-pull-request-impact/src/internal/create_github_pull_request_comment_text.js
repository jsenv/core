const GITHUB_MAX_COMMENT_LENGTH = 65536;

export const createGitHubPullRequestCommentText = ({
  header = "",
  warnings = [],
  body,
  footer = "",
  // for unit test
  maxLength = GITHUB_MAX_COMMENT_LENGTH,
}) => {
  // header and footer must not be truncated because they are part of the message identity
  // truncating them would likely make the message non readable.
  // Moreover header oftens contains a hidden comment message to identify the comment

  const commentText = composeCommentText({
    header,
    warnings,
    body,
    footer,
  });

  const commentLength = Buffer.byteLength(commentText);

  if (commentLength < maxLength) {
    return commentText;
  }

  // on veut ajouter un warning + savoir combien de place il nous reste
  return truncateComment({
    maxLength,
    commentLength,
    header,
    warnings,
    body,
    footer,
  });
};

const truncateComment = ({
  commentLength,
  maxLength,
  header,
  warnings,
  body,
  footer,
}) => {
  const warningsWithTruncateWarning = [
    ...warnings,
    `**Warning:** The comment body was truncated to fit GitHub limit on comment length.
As the body is truncated the message might be hard to read.
For the record the full comment length was ${commentLength} bytes.`,
  ];

  const commentWithFakeBody = composeCommentText({
    header,
    warnings: warningsWithTruncateWarning,
    body: "a",
    footer,
  });
  const commentWithFakeBodyLength = Buffer.byteLength(commentWithFakeBody);
  let bytesAvailableForBody = maxLength - commentWithFakeBodyLength;
  // add 1 because fake body had one letter
  bytesAvailableForBody++;
  // remove byte length of `…` that is appended to the truncated body
  bytesAvailableForBody -= Buffer.byteLength(`…`);

  const bodyTruncated = `${body.slice(0, bytesAvailableForBody)}…`;

  return composeCommentText({
    header,
    warnings: warningsWithTruncateWarning,
    body: bodyTruncated,
    footer,
  });
};

const composeCommentText = ({ header, warnings, body, footer }) => {
  const warningsAsText = composeWarningsText(warnings);
  const parts = [header, warningsAsText, body, footer].filter(
    (string) => string.length > 0,
  );

  return parts.join(`

`);
};

const composeWarningsText = (warnings) => {
  if (warnings.length === 0) {
    return "";
  }

  return `---

${warnings.join(`

`)}

---`;
};
