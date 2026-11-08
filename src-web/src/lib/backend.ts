// 后端目标单一来源：三形态（离线桌面 / 服务桌面 / web 部署）在此收敛成 base 地址与鉴权头
// 形态判据只有两条：VITE_API_URL 是否指向远程、sidecar 令牌是否已就绪

import { sidecarToken } from "@/lib/tauri"

/** 远程 API 根地址；空串=同源部署（走相对路径） */
const baseURL = (import.meta.env.VITE_API_URL ?? "") as string

/** 拼公共接口（/api）或本机接口（/offline）的完整地址
 * @param path 以 / 开头的路由路径 @returns 可直接请求的 URL */
export function apiUrl(path: string): string {
  return `${baseURL}${path}`
}

/** 组装带 sidecar 鉴权头的 Headers；令牌为空（浏览器/服务器形态）则原样返回
 * @param init 既有头 @returns 合并后的 Headers */
export async function authHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init)
  const token = await sidecarToken()
  if (token) headers.set("x-tauri-token", token)
  return headers
}

/** Eden treaty 请求拦截器：有令牌才回传追加头
 * @param _path 请求路径（treaty 约定占位） @param options 已组装的 fetch 选项 @returns 追加项或 void */
export async function treatyRequest(
  _path: string,
  options: RequestInit
): Promise<RequestInit | void> {
  const token = await sidecarToken()
  if (!token) return
  return { headers: await authHeaders(options.headers) }
}
