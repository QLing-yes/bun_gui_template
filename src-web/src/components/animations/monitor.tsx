"use client"

import animation from "react-useanimations/lib/monitor"

import { UseAnimation, type UseAnimationProps } from "@/components/use-animation"

// "Monitor" from https://useanimations.com (MIT): https://useanimations.com/icons/monitor
export function AnimatedMonitor(
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
