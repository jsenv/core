export const CONFIRM_CONSTRAINT = {
  name: "confirm",
  check: (element) => {
    const confirmMessage = element.getAttribute("data-confirm");
    if (!confirmMessage) {
      return "";
    }
    // eslint-disable-next-line no-alert
    if (window.confirm(confirmMessage)) {
      return "";
    }
    return "";
  },
};
