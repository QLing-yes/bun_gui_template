import animation from "react-useanimations/lib/sun"

import { UseAnimation, type UseAnimationProps } from "@/components/use-animation"

// "Sun" from https://useanimations.com (MIT): https://useanimations.com/icons/sun
export function AnimatedSun(
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
