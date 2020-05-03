var REACT_ELEMENT_TYPE
export default function (type, props, key, children) {
  if (!REACT_ELEMENT_TYPE) {
    REACT_ELEMENT_TYPE =
      (typeof Symbol === "function" && Symbol.for && Symbol.for("react.element")) || 0xeac7
  }
  var defaultProps = type && type.defaultProps
  var childrenLength = arguments.length - 3
  if (!props && childrenLength !== 0) {
    // If we're going to assign props.children, we create a new object now
    // to avoid mutating defaultProps.
    props = {
      // eslint-disable-next-line no-void
      children: void 0,
    }
  }
  if (childrenLength === 1) {
    props.children = children
  } else if (childrenLength > 1) {
    var childArray = new Array(childrenLength)
    for (var i = 0; i < childrenLength; i++) {
      // eslint-disable-next-line prefer-rest-params
      childArray[i] = arguments[i + 3]
    }
    props.children = childArray
  }
  if (props && defaultProps) {
    for (var propName in defaultProps) {
      // eslint-disable-next-line no-void
      if (props[propName] === void 0) {
        props[propName] = defaultProps[propName]
      }
    }
  } else if (!props) {
    props = defaultProps || {}
  }
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key: key === undefined ? null : `${key}`,
    ref: null,
    props,
    _owner: null,
  }
}
