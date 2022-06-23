export const counterReducer = (state = { value: 0 }, action) => {
  if (action.type === "INCREMENT") {
    return {
      ...state,
      value: state.value + 1,
    }
  }
  if (action.type === "DECREMENT") {
    return {
      ...state,
      value: state.value - 1,
    }
  }
  return state
}
