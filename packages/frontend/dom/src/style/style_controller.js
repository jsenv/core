/**
 *
 *
 */

export const createStyleControlelr = () => {
  const animation = element.animate({}, { duration: 0, fill: "forwards" });
  animation.pause();

  let styles = {};

  const updateAnimation = () => {
    animation.effect.setKeyframes([styles]);
    animation.play();
    animation.pause();
  };

  return {
    set: (element, styles) => {
      Object.assign(styles, styles);
      updateAnimation();
    },
    delete: (element, ...props) => {
      for (const prop of props) {
        delete styles[prop];
      }
      updateAnimation();
    },
    clear: (element) => {
      styles = {};
      updateAnimation();
    },
    get: (element) => {
      return { ...styles };
    },
    commit: (element) => {},
  };
};
