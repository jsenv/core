export const errorToMarkdown = (error) => {
  const errorIsAPrimitive =
    error === null ||
    (typeof error !== "object" && typeof error !== "function");

  if (errorIsAPrimitive) {
    return `\`\`\`js
${error}
\`\`\``;
  }
  return `\`\`\`
${error.stack}
\`\`\``;
};
