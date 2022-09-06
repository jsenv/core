import { label } from "./label.js"

export const CountLabel = ({ count }) => {
  return (
    <span id="count_label" style="color: black">
      {label}: {count}
    </span>
  )
}
