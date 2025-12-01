export const CONFIRM_CONSTRAINT = {
  name: "confirm",
  check: (element) => {
    const messageAttribute = element.getAttribute("data-confirm");
    if (!messageAttribute) {
      return "";
    }
    // eslint-disable-next-line no-alert
    if (window.confirm(messageAttribute)) {
      return "";
    }
    return "";
  },
};
