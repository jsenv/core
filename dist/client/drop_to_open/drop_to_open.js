const initDropToOpen = ({ rootDirectoryUrl }) => {
  const dataTransferCandidates = [
    (dataTransfer) => {
      if (!dataTransfer.types.includes("resourceurls")) {
        return null;
      }
      return () => {
        const data = dataTransfer.getData("resourceurls");
        const urls = JSON.parse(data);
        if (!Array.isArray(urls) || urls.length === 0) {
          return;
        }
        const [url] = urls;
        const fileUrl = new URL(url).href;
        let serverUrl;

        if (fileUrl.startsWith(rootDirectoryUrl)) {
          const serverRelativeUrl = fileUrl.slice(rootDirectoryUrl.length);
          serverUrl = `/${serverRelativeUrl}`;
        } else {
          serverUrl = `/@fs/${fileUrl}`;
        }
        window.location.href = serverUrl;
      };
    },
  ];

  document.addEventListener("dragover", (event) => {
    for (const candidate of dataTransferCandidates) {
      const dataTransferHandler = candidate(event.dataTransfer);
      if (dataTransferHandler) {
        event.preventDefault();
        return;
      }
    }
  });
  document.addEventListener("drop", (event) => {
    let handler;
    for (const candidate of dataTransferCandidates) {
      const dataTransferHandler = candidate(event.dataTransfer);
      if (dataTransferHandler) {
        handler = dataTransferHandler;
        break;
      }
    }
    event.preventDefault();
    handler();
  });
};

export { initDropToOpen };
