// 首页：组件演示区

import { PAGE_PAD_CLASS } from "@/components/layout/class-names"
import { PageCanvas } from "@/components/layout/page-canvas"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function HomePage() {
  return (
    <PageCanvas>
      <div className={cn(PAGE_PAD_CLASS, "leading-loose")}>
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Project ready!</CardTitle>
            <CardDescription>
              You may now add components and start building.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4">
            <p>We&apos;ve already added the button component for you.</p>
            <Button>Button</Button>
          </CardContent>
        </Card>
      </div>
    </PageCanvas>
  )
}
