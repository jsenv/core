import { computed, signal } from "@preact/signals";

export const documentUrlSignal = signal(
  typeof window === "undefined" ? "http://localhost" : window.location.href,
);
export const useDocumentUrl = () => {
  return documentUrlSignal.value;
};
export const updateDocumentUrl = (value) => {
  documentUrlSignal.value = value;
};

const documentResourceSignal = computed(() => {
  const documentUrl = documentUrlSignal.value;
  const documentResource = urlToResource(documentUrl);
  return documentResource;
});
export const useDocumentResource = () => {
  return documentResourceSignal.value;
};
const urlToResource = (url) => {
  const scheme = urlToScheme(url);
  if (scheme === "file") {
    const urlAsStringWithoutFileProtocol = String(url).slice("file://".length);
    return urlAsStringWithoutFileProtocol;
  }
  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = String(url).slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    const urlAsStringWithoutOrigin = afterProtocol.slice(pathnameSlashIndex);
    return urlAsStringWithoutOrigin;
  }
  const urlAsStringWithoutProtocol = String(url).slice(scheme.length + 1);
  return urlAsStringWithoutProtocol;
};
const urlToScheme = (url) => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }
  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};
