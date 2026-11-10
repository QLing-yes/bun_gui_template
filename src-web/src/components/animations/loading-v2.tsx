"use client"

import animation from "react-useanimations/lib/loading2"

import { UseAnimation, type UseAnimationProps } from "@/components/use-animation"

// "Loading V2" from https://useanimations.com (MIT): https://useanimations.com/icons/loading-v2
export function AnimatedLoadingV2(
  props: Omit<UseAnimationProps, "animationData">
) {
  return (
    <UseAnimation
      animationData={animation.animationData}
      interaction="loop"
      {...props}
    />
  )
}
