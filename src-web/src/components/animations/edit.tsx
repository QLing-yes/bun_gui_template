import animation from "react-useanimations/lib/edit"

import { UseAnimation, type UseAnimationProps } from "@/components/use-animation"

// "Edit" from https://useanimations.com (MIT): https://useanimations.com/icons/edit
export function AnimatedEdit(
  props: Omit<UseAnimationProps, "animationData">
) {
  return (
    <UseAnimation
      animationData={animation.animationData}
      interaction="hover"
      {...props}
    />
  )
}
