export const setLinkHrefForParentWindow = (a, href) => {
  a.href = href;
  a.onclick = (e) => {
    if (e.ctrlKey || e.metaKey) {
      return;
    }
    e.preventDefault();
    window.parent.location.href = href;
  };
};
