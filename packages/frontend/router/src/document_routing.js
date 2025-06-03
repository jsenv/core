import { signal } from "@preact/signals";

let debugDocumentRouting = false;

export const documentIsRoutingSignal = signal(false);
export const startDocumentRouting = () => {
  if (debugDocumentRouting) {
    console.log("startDocumentRouting");
  }
  documentIsRoutingSignal.value = true;
};
export const endDocumentRouting = () => {
  if (debugDocumentRouting) {
    console.log("endDocumentRouting");
  }
  documentIsRoutingSignal.value = false;
};
export const routingWhile = async (fn, ...args) => {
  startDocumentRouting();
  try {
    await fn(...args);
  } finally {
    endDocumentRouting();
  }
};

export const documentUrlSignal = signal(window.location.href);
export const updateDocumentUrl = (value) => {
  documentUrlSignal.value = value;
};
export const useDocumentUrl = () => {
  return documentUrlSignal.value;
};

export const documentStateSignal = signal(null);
export const updateDocumentState = (value) => {
  documentStateSignal.value = value;
};
export const useDocumentState = () => {
  return documentStateSignal.value;
};
