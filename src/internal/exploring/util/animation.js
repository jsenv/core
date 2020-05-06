const animateFallback = () => {
  return Promise.resolve()
}

const animateNative = (node, keyframes, { cancellationToken, ...options } = {}) => {
  const animation = node.animate(keyframes, options)
  if (cancellationToken) {
    cancellationToken.register(() => {
      animation.cancel()
    })
  }
  return new Promise((resolve) => {
    animation.onfinish = resolve
  })
}

export const canUseAnimation = () => typeof HTMLElement.prototype.animate === "function"

export const animateElement = canUseAnimation() ? animateNative : animateFallback

export const fadeIn = (node, options) =>
  animateElement(
    node,
    [
      {
        opacity: 0,
      },
      {
        opacity: 1,
      },
    ],
    options,
  )

export const fadeOut = (node, options) =>
  animateElement(
    node,
    [
      {
        opacity: 1,
      },
      {
        opacity: 0,
      },
    ],
    options,
  )

export const move = (fromNode, toNode, options) => {
  const fromComputedStyle = window.getComputedStyle(fromNode)
  const toComputedStyle = window.getComputedStyle(toNode)
  // get positions of input in toolbar and aElement
  const fromPosition = fromNode.getBoundingClientRect()
  const toPosition = toNode.getBoundingClientRect()

  // we'll do the animation in a div preventing overflow and pointer events
  const div = document.createElement("div")
  div.style.position = "absolute"
  div.style.left = 0
  div.style.top = 0
  div.style.right = 0
  div.style.bottom = 0
  div.style.overflow = "hidden"
  div.style.pointerEvents = "none"

  // clone node and style it
  const copy = fromNode.cloneNode(true)
  copy.style.position = "absolute"
  copy.style.left = `${fromPosition.left}px`
  copy.style.top = `${fromPosition.top}px`
  copy.style.maxWidth = `${fromPosition.right - fromPosition.left}px`
  copy.style.overflow = toComputedStyle.overflow
  copy.style.textOverflow = toComputedStyle.textOverflow
  div.appendChild(copy)
  document.body.appendChild(div)

  const left = toPosition.left - fromPosition.left - (parseInt(fromComputedStyle.paddingLeft) || 0)
  const top = toPosition.top - fromPosition.top - (parseInt(fromComputedStyle.paddingTop) || 0)
  // define final position of new element and the duration
  const translate = `translate(${left}px, ${top}px)`

  // animate new element
  return animateElement(
    copy,
    [
      {
        transform: "translate(0px, 0px)",
        backgroundColor: fromComputedStyle.backgroundColor,
        color: fromComputedStyle.color,
        fontSize: fromComputedStyle.fontSize,
        height: `${fromPosition.bottom - fromPosition.top}px`,
        width: "100%",
      },
      {
        offset: 0.9,
        backgroundColor: fromComputedStyle.backgroundColor,
      },
      {
        transform: translate,
        backgroundColor: toComputedStyle.backgroundColor,
        color: toComputedStyle.color,
        fontSize: toComputedStyle.fontSize,
        height: `${toPosition.bottom - toPosition.top}px`,
        width: toComputedStyle.width,
      },
    ],
    options,
  ).then(() => {
    div.parentNode.removeChild(div)
  })
}

// the whole point of this toolbar animation wass to flight a visual imperfection when it's done by css transition.
// This imperfection is a white line sometimes flickering at the bottom of the page.
// It got fixed by removing the usage of calc(100vh - 40px)
// It was hapenning in chrome, safari but not inside Firefox
// I assume it's because Firefox does not read parent element min-height while
// chrome use it to compute min-height: 100%
export const createToolbarAnimation = () => {
  const collapsedState = {
    "#page": { paddingBottom: 0 },
    "footer": { height: 0 },
    "#toolbar": { visibility: "hidden" },
  }
  const expandedState = {
    "#page": { paddingBottom: "40px" },
    "footer": { height: "40px" },
    "#toolbar": { visibility: "visible" },
  }
  const expandTransition = transit(collapsedState, expandedState, { duration: 300 })

  const expand = () => {
    expandTransition.play()
  }

  const collapse = () => {
    expandTransition.reverse()
  }

  return { expand, collapse }
}

export const transit = (
  fromState,
  toState,
  { commitStyles = true, fill = "both", duration = 300 } = {},
) => {
  const steps = []
  Object.keys(fromState).forEach((selector) => {
    const fromStyles = {}
    const toStyles = {}
    const element = document.querySelector(selector)

    const keyframes = []
    const fromProperties = fromState[selector]
    const toProperties = toState[selector]
    Object.keys(fromProperties).forEach((propertyName) => {
      const from = fromProperties[propertyName]
      const to = toProperties[propertyName]
      fromStyles[propertyName] = from
      toStyles[propertyName] = to
    })
    keyframes.push(fromStyles, toStyles)

    let animation
    if (canUseAnimation()) {
      const effect = new KeyframeEffect(element, keyframes, { fill, duration })
      animation = new Animation(effect)
    } else {
      animation = {
        playbackRate: 1,
        play: () => {
          animation.onfinish()
        },
        reverse: () => {
          animation.playbackRate = -1
          animation.onfinish()
        },
        onfinish: () => {},
      }
    }

    steps.push({
      element,
      animation,
      fromStyles,
      toStyles,
    })
  })

  const play = async () => {
    await Promise.all(
      steps.map(({ animation, element, toStyles }) => {
        return new Promise((resolve) => {
          animation.onfinish = () => {
            if (commitStyles) {
              setStyles(element, toStyles)
            }
            resolve()
          }
          if (animation.playbackRate === -1) {
            animation.reverse()
          } else {
            animation.play()
          }
        })
      }),
    )
  }

  const reverse = async () => {
    await Promise.all(
      steps.map(({ animation, element, fromStyles }) => {
        return new Promise((resolve) => {
          animation.onfinish = () => {
            if (commitStyles) {
              setStyles(element, fromStyles)
            }
            resolve()
          }
          animation.reverse()
        })
      }),
    )
  }

  return { play, reverse }
}

const setStyles = (element, styles) => {
  Object.keys(styles).forEach((styleName) => {
    element.style[styleName] = styles[styleName]
  })
}
