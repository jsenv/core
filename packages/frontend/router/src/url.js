import { computed } from "@preact/signals";
import { useCallback } from "preact/hooks";
import { documentUrlSignal } from "./document_routing.js";
import { normalizeUrl } from "./normalize_url.js";
import { goTo } from "./router.js";

const urlParamSignalMap = new Map();
// can be called multiple times by hooks
const signalForUrlParam = (name, getter) => {
  const existingSignal = urlParamSignalMap.get(name);
  if (existingSignal) {
    return existingSignal;
  }
  const signalForFirstCall = computed(() => {
    const url = documentUrlSignal.value;
    return getter(url);
  });
  urlParamSignalMap.set(name, signalForFirstCall);
  return signalForFirstCall;
};

export const useUrlBooleanParam = (name, { replace }) => {
  const urlBooleanParamSignal = signalForUrlBooleanParam(name);
  const urlBooleanParam = urlBooleanParamSignal.value;
  const enable = useCallback(() => {
    const urlWithBooleanParam = withUrlBooleanParam(
      documentUrlSignal.peek(),
      name,
    );
    goTo(urlWithBooleanParam, { replace });
  }, [name, replace]);
  const disable = useCallback(() => {
    const urlWithoutBooleanParam = withoutUrlBooleanParam(
      documentUrlSignal.peek(),
      name,
    );
    goTo(urlWithoutBooleanParam, { replace });
  }, [name, replace]);
  return [urlBooleanParam, enable, disable];
};
const signalForUrlBooleanParam = (name) => {
  return signalForUrlParam(name, (url) => {
    return new URL(url).searchParams.has(name);
  });
};
const withUrlBooleanParam = (url, name) => {
  return updateUrl(url, () => {
    const urlObject = new URL(url);
    const { searchParams } = urlObject;
    if (searchParams.has(name)) {
      return null;
    }
    searchParams.set(name, "");
    return urlObject.toString();
  });
};
const withoutUrlBooleanParam = (url, name) => {
  return updateUrl(url, () => {
    const urlObject = new URL(url);
    const { searchParams } = urlObject;
    if (!searchParams.has(name)) {
      return null;
    }
    searchParams.delete(name);
    return urlObject.toString();
  });
};

export const useUrlStringParam = (
  name,
  // TODO: add a param to enum the allowed values
) => {
  const urlStringParamSignal = signalForUrlStringParam(name);
  const urlStringParam = urlStringParamSignal.value;
  const set = useCallback(
    (value) => {
      if (value) {
        const urlWithStringParam = withUrlStringParam(
          documentUrlSignal.peek(),
          name,
          value,
        );
        goTo(urlWithStringParam);
        return;
      }
      const urlWithoutStringParam = withoutUrlStringParam(
        documentUrlSignal.peek(),
        name,
      );
      goTo(urlWithoutStringParam);
    },
    [name],
  );
  return [urlStringParam, set];
};
const signalForUrlStringParam = (name) => {
  return signalForUrlParam(name, (url) => {
    return new URL(url).searchParams.get(name);
  });
};
export const withUrlStringParam = (url, name, value) => {
  return updateUrl(url, () => {
    const urlObject = new URL(url);
    const { searchParams } = urlObject;
    searchParams.set(name, value);
    return urlObject.toString();
  });
};
const withoutUrlStringParam = (url, name) => {
  return updateUrl(url, () => {
    const urlObject = new URL(url);
    const { searchParams } = urlObject;
    if (!searchParams.has(name)) {
      return null;
    }
    searchParams.delete(name);
    return urlObject.toString();
  });
};

const updateUrl = (url, urlTransformer) => {
  const newUrl = urlTransformer();
  if (!newUrl) {
    return url;
  }
  const newUrlString = String(newUrl);
  const newUrlNormalized = normalizeUrl(newUrlString);
  return newUrlNormalized;
};
