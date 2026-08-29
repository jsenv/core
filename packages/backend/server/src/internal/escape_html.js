const HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value) => {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
};
