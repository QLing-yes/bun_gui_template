import animation from "react-useanimations/lib/moon"

import { UseAnimation, type UseAnimationProps } from "@/components/use-animation"

// "Moon" from https://useanimations.com (MIT): https://useanimations.com/icons/moon
export function AnimatedMoon(
  props: Omit<UseAnimationProps, "animationData">
) {
  return (
    <UseAnimation
      animationData={animation.animationData}
      interaction="hover-replay"
      {...props}
    />
  )
}
