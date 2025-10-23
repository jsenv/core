export const createUniqueValueConstraint = (
  // the set might be incomplete (the front usually don't have the full copy of all the items from the backend)
  // but this is already nice to help user with what we know
  // it's also possible that front is unsync with backend, preventing user to choose a value
  // that is actually free.
  // But this is unlikely to happen and user could reload the page to be able to choose that name
  // that suddenly became available
  existingValueSet,
  message = `"{value}" already exists. Please choose another value.`,
) => {
  return {
    name: "unique_value",
    check: (input) => {
      const inputValue = input.value;
      const hasConflict = existingValueSet.has(inputValue);
      // console.log({
      //   inputValue,
      //   names: Array.from(otherNameSet.values()),
      //   hasConflict,
      // });
      if (hasConflict) {
        return message.replace("{value}", inputValue);
      }
      return "";
    },
  };
};
