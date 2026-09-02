/**
 * A view transition already playing, walked back to where it started.
 *
 * The way back is not a second transition. A transition photographs the state
 * it leaves, so one started to undo another photographs the state being undone:
 * the pictures then animate FROM where the reader is TO where they were, which
 * is a way forward to somewhere, not a return. The same pictures are run
 * backwards instead, and the state is put back UNDER them before they are
 * dropped — the two are the same thing at the instant they are swapped, so
 * nothing is seen changing.
 *
 * The way back is paid for in DISTANCE, not in time. A movement is eased: at
 * half of its TIME the pictures have covered ~80% of their distance, so one
 * caught "half-way" by the eye has barely begun by the clock. Rewound at -1 it
 * plays those few milliseconds back through the steep end of the curve — nearly
 * the whole visible distance collapses into two frames, and what one sees is a
 * snap, not a return. So the pictures are walked over how far they LOOK from
 * where they are going, at the movement's own pace, each animation at the rate
 * that gets it there in that time.
 *
 * Where they visibly stand is computed from the clock THROUGH the easing curve,
 * never read off the pseudo-elements: getComputedStyle on them answers with the
 * un-animated value — the animated one lives on the compositor, where no
 * reading from here reaches. It is the same trap as the playbackRate setter,
 * which is why every rate below is handed over with updatePlaybackRate.
 */

export const viewTransitionAnimations = () => {
  const animations = [];
  for (const animation of document.getAnimations()) {
    const pseudoElement = animation.effect?.pseudoElement;
    if (pseudoElement && pseudoElement.startsWith("::view-transition")) {
      animations.push(animation);
    }
  }
  return animations;
};

/**
 * The animation carrying the movement, not the first that comes: everything a
 * movement takes along is animated too — a bar held where it stands, a trait
 * under a tab row, a popup travelling with its page — each with a pace of its
 * own. A time read on one of those and turned into a fraction of ANOTHER lands
 * anywhere, over 1 more often than not, which reads as a movement already over.
 * The names are tried in order, so a caller can say "the pages, or the document
 * when the pages are the document".
 */
export const findLeadAnimation = (animations, leadNames) => {
  for (const leadName of leadNames) {
    const found = animations.find((candidate) =>
      candidate.effect?.pseudoElement?.includes(leadName),
    );
    if (found) {
      return found;
    }
  }
  return null;
};

// How far the pictures visibly are into their movement, between 0 and 1.
const visibleProgress = (animation) => {
  const timing = animation.effect.getComputedTiming();
  const duration = timing.delay + timing.activeDuration;
  if (!duration) {
    return null;
  }
  const temporal = animation.currentTime / duration;
  // The easing sits on the keyframes, where a CSS animation's
  // animation-timing-function ends up. "ease" is what these movements play;
  // anything else (linear under a finger) maps time to distance one for one.
  const easing = animation.effect.getKeyframes()[0]?.easing;
  const ratio =
    easing === "ease" ? easedProgress(temporal, CSS_EASE) : temporal;
  return { duration, ratio };
};

// A frame's worth of movement is not a movement: under it the pictures are home
// already, and a rate computed over it is a division by nearly nothing.
const ONE_FRAME = 17;

// How long the walk should take, and 0 where the movement cannot say — a lead
// nobody named, a duration of nothing. The rates below fall back to the
// movement's own pace there, which is the browser's answer and the only one
// left.
const walkTime = (animations, leadNames, remaining) => {
  const lead = findLeadAnimation(animations, leadNames);
  const visible = lead ? visibleProgress(lead) : null;
  if (!visible) {
    return 0;
  }
  const ratio = remaining ? 1 - visible.ratio : visible.ratio;
  return ratio * visible.duration;
};

/**
 * The pictures, sent back to the state the movement left. Returns false when
 * there are no pictures — a movement the browser skipped, or one whose
 * animations it has not created yet.
 */
export const walkPicturesHome = (animations, leadNames) => {
  if (animations.length === 0) {
    return false;
  }
  const wallTime = walkTime(animations, leadNames, false);
  for (const animation of animations) {
    const timeCovered = animation.currentTime;
    const rate =
      wallTime > ONE_FRAME && timeCovered > 0 ? -(timeCovered / wallTime) : -1;
    animation.updatePlaybackRate(rate);
  }
  return true;
};

/**
 * The pictures, sent on to the state the movement was going to — a way back
 * that is itself turned round, when the door is pressed a third time. The same
 * arithmetic read from the other end: what is left to cover, walked at the
 * movement's own pace.
 */
export const walkPicturesOn = (animations, leadNames) => {
  if (animations.length === 0) {
    return false;
  }
  const wallTime = walkTime(animations, leadNames, true);
  for (const animation of animations) {
    const timing = animation.effect.getComputedTiming();
    const timeLeft =
      timing.delay + timing.activeDuration - animation.currentTime;
    const rate = wallTime > ONE_FRAME && timeLeft > 0 ? timeLeft / wallTime : 1;
    animation.updatePlaybackRate(rate);
  }
  return true;
};

/**
 * When the pictures have arrived, whichever way they were walking. A rejection
 * is an outcome — animations cancelled by a transition that took this one's
 * place — and the caller finds nothing left to undo either way.
 */
export const whenPicturesArrived = (animations) => {
  if (animations.length === 0) {
    // Nothing to run — a transition the browser skipped, or one that never
    // became ready. There is no picture to undo either, so what the caller does
    // next is the state alone.
    return Promise.resolve();
  }
  return Promise.all(
    animations.map((animation) => animation.finished.catch(() => {})),
  );
};

// CSS `ease`, evaluated: time in, distance out. Solved numerically because the
// curve is parametric — two cubics sharing a parameter, with no closed form for
// one against the other. Twenty halvings put the answer well under a pixel of a
// screen-wide movement.
const CSS_EASE = [0.25, 0.1, 0.25, 1];
const bezierAxis = (s, a, b) =>
  3 * (1 - s) * (1 - s) * s * a + 3 * (1 - s) * s * s * b + s * s * s;
const easedProgress = (x, [x1, y1, x2, y2]) => {
  let low = 0;
  let high = 1;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (bezierAxis(mid, x1, x2) < x) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return bezierAxis((low + high) / 2, y1, y2);
};
