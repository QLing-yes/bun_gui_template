// 首页：组件演示区

import { PageCard } from "@/components/page-card"
import { Button } from "@/components/ui/button"

export function HomePage() {
  return (
    <PageCard
      title="Project ready!"
      description="You may now add components and start building."
    >
      <p>We&apos;ve already added the button component for you.</p>
      <Button>Button</Button>
    </PageCard>
  )
}
