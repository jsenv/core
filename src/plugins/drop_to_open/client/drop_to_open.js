export const initDropToOpen = ({ rootDirectoryUrl }) => {
  document.addEventListener("dragover", (event) => {
    if (!event.dataTransfer.types.includes("resourceurls")) {
      return;
    }
    event.preventDefault();
  });
  document.addEventListener("drop", (event) => {
    if (!event.dataTransfer.types.includes("resourceurls")) {
      return;
    }
    const data = event.dataTransfer.getData("resourceurls");
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
    event.preventDefault();
    window.location.href = serverUrl;
  });
};
