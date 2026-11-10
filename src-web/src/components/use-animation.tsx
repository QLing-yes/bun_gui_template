import * as React from "react"
import UseAnimations, {
  type Interaction,
  type UseAnimationsProps,
} from "react-useanimations"

// Animated icons from https://useanimations.com (MIT).
// Docs: https://useanimations.com/documentation#shadcn

export type { Interaction }

export type UseAnimationProps = Omit<UseAnimationsProps, "animation"> & {
  /** Lottie JSON of the icon. */
  animationData: object
  /** How the icon plays: on loop, on click (toggle or replay) or on hover. */
  interaction?: Interaction
  /** @deprecated Not needed: react-useanimations plays every icon. */
  fullPlayer?: boolean
}

export function UseAnimation({
  animationData,
  interaction,
  fullPlayer: _fullPlayer,
  ...props
}: UseAnimationProps) {
  const animation = React.useMemo(
    () => ({ animationData, interaction }),
    [animationData, interaction]
  )
  return <UseAnimations animation={animation} {...props} />
}
