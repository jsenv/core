export const getHrefTargetInfo = (href) => {
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

  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(href, window.location.href);

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
