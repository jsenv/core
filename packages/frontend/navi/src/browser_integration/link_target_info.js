export const getLinkTargetInfo = (href) => {
  href = String(href);

  if (!href || href.trim() === "") {
    return {
      targetIsEmpty: true,
      targetIsCurrent: false,
      targetIsAnchor: false,
      targetIsSameOrigin: true,
      targetIsSameSite: true,
    };
  }

  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(href, window.location.href);

  let targetIsCurrent = false;
  current: {
    targetIsCurrent = currentUrl.href === targetUrl.href;
  }
  let targetIsAnchor = false;
  anchor: {
    if (
      currentUrl.pathname === targetUrl.pathname &&
      currentUrl.search === targetUrl.search &&
      targetUrl.hash !== ""
    ) {
      targetIsAnchor = true;
    }
  }
  let targetIsSameOrigin = false;
  same_origin: {
    const currentOrigin = currentUrl.origin;
    const targetOrigin = targetUrl.origin;
    targetIsSameOrigin = currentOrigin === targetOrigin;
  }
  let targetIsSameSite = false;
  same_site: {
    const baseDomain = (hostname) => {
      const parts = hostname.split(".").slice(-2);
      return parts.join(".");
    };
    const currentDomain = baseDomain(currentUrl.hostname);
    const targetDomain = baseDomain(targetUrl.hostname);
    targetIsSameSite = currentDomain === targetDomain;
  }

  return {
    targetIsEmpty: false,
    targetIsCurrent,
    targetIsAnchor,
    targetIsSameOrigin,
    targetIsSameSite,
  };
};

export const isAnchor = (href) => getLinkTargetInfo(href).targetIsAnchor;
export const isSameOrigin = (href) =>
  getLinkTargetInfo(href).targetIsSameOrigin;
export const isSameSite = (href) => getLinkTargetInfo(href).targetIsSameSite;
