const setupCheckedProgrammaticChange = () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "checked",
  );
  Object.defineProperty(HTMLInputElement.prototype, "checked", {
    get() {
      return originalDescriptor.get.call(this);
    },
    set(value) {
      const oldValue = this.checked;
      originalDescriptor.set.call(this, value);
      if (oldValue === value) {
        return;
      }
      if (this.type === "radio" || this.type === "checkbox") {
        this.dispatchEvent(
          new CustomEvent("programmaticchange", {
            bubbles: true,
            detail: { oldValue, newValue: value },
          }),
        );
      }
    },
    configurable: true,
  });

  // ✅ Cleanup function
  return () => {
    Object.defineProperty(
      HTMLInputElement.prototype,
      "checked",
      originalDescriptor,
    );
  };
};
setupCheckedProgrammaticChange();
