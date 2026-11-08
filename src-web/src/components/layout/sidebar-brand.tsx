// 侧栏头部品牌区：logo + 应用名（折叠成图标态时仅剩 logo）

import { BRAND_NAME, BrandLogo } from "@/components/brand-logo"
import { SIDEBAR_LABEL_CLASS } from "@/components/layout/class-names"
import { cn } from "cn"
import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function SidebarBrand() {
  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
          >
            <BrandLogo />
            {/* 折叠成图标时名称淡出并退出占位（flex-none + w-0），使 logo 在图标栏内左右居中 */}
            <div
              className={cn(
                SIDEBAR_LABEL_CLASS,
                "group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:flex-none"
              )}
            >
              <span className="truncate font-semibold">{BRAND_NAME}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
}
