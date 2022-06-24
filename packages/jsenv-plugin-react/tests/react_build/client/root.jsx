import { useEffect } from "react"

export const Root = ({ onRender }) => {
  useEffect(() => {
    onRender()
  }, [])
  return <span>Hello world</span>
}
