const executeInNewContextUsingVM = async (code) => {
  // eslint-disable-next-line import/no-unresolved
  const { runInNewContext } = await import("node:vm");
  return runInNewContext(code);
};

const executeInNewContextUsingIframe = (code) => {
  const iframe = document.createElement("iframe");

  iframe.style.display = "none";
  document.body.appendChild(iframe);

  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframe.contentDocument;

  iframeDocument.write(`<script>
  window.execute = () => {
    const value = ${code}
    return value
  }
</script>`);

  try {
    const value = iframeWindow.execute();
    return value;
  } finally {
    document.body.removeChild(iframe);
  }
};

export const executeInNewContext =
  typeof window === "object"
    ? executeInNewContextUsingIframe
    : executeInNewContextUsingVM;
