import { computed } from "@preact/signals";
import { useMemo } from "preact/hooks";

import { documentUrlSignal } from "./document_url_signal.js";

// `currentUrlString`: the address the href is compared with — the document's by
// default. A caller subscribed to documentUrlSignal passes the value it read,
// which is ahead of window.location while a debounced write is pending.
export const getHrefTargetInfo = (
  href,
  currentUrlString = window.location.href,
) => {
  href = String(href);

  if (!href || href.trim() === "") {
    return {
      isEmpty: true,
      isCurrent: false,
      isAnchor: false,
      isSameOrigin: true,
      isSameSite: true,
    };
  }

  const currentUrl = new URL(currentUrlString);
  const targetUrl = new URL(href, currentUrlString);

  let isCurrent = false;
  current: {
    isCurrent = currentUrl.href === targetUrl.href;
  }
  let isAnchor = false;
  anchor: {
    if (
      currentUrl.pathname === targetUrl.pathname &&
      currentUrl.search === targetUrl.search &&
      targetUrl.hash !== ""
    ) {
      isAnchor = true;
    }
  }
  let isSameOrigin = false;
  same_origin: {
    const currentOrigin = currentUrl.origin;
    const targetOrigin = targetUrl.origin;
    isSameOrigin = currentOrigin === targetOrigin;
  }
  let isSameSite = false;
  same_site: {
    const baseDomain = (hostname) => {
      const parts = hostname.split(".").slice(-2);
      return parts.join(".");
    };
    const currentDomain = baseDomain(currentUrl.hostname);
    const targetDomain = baseDomain(targetUrl.hostname);
    isSameSite = currentDomain === targetDomain;
  }

  return {
    isEmpty: false,
    isCurrent,
    isAnchor,
    isSameOrigin,
    isSameSite,
  };
};

export const isAnchor = (href) => getHrefTargetInfo(href).isAnchor;
export const isSameOrigin = (href) => getHrefTargetInfo(href).isSameOrigin;
export const isSameSite = (href) => getHrefTargetInfo(href).isSameSite;

// A field of getHrefTargetInfo that depends on the page one is on (isCurrent,
// isAnchor), read through a computed of that one boolean: the caller re-renders
// when it flips, not at every address write — a search param bound to a wheel
// writes the address at every notch.
export const useHrefTargetFlag = (href, flagName) => {
  const flagSignal = useMemo(
    () =>
      computed(
        () => getHrefTargetInfo(href, documentUrlSignal.value)[flagName],
      ),
    [href, flagName],
  );
  return flagSignal.value;
};
