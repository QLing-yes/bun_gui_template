// SPA 路由表

import { createHashRouter } from "react-router"

import { AppShell } from "@/components/layout/app-shell"
import { LoginPage } from "./pages/login"
import { shellRoutes } from "./registry"

/** 路由实例（hash 模式：Tauri 各平台与静态 web 部署零配置，刷新深链接不 404） */
export const router = createHashRouter([
  // 登录页独立于外壳，由用户操作进入（默认页仍是主界面）
  { path: "/login", Component: LoginPage },
  // 外壳子页见 routes/registry（与路由轨道同一来源）
  { path: "/", Component: AppShell, children: shellRoutes },
])
