import { collectPermRoutes } from "@/app/common/no_global";

/** 编译后的权限路由匹配项 */
interface PermMatcher {
  /** 请求方法（大写） */
  method: string;
  /** 权限编号 */
  code: number;
  /** 路由模板正则 */
  pattern: RegExp;
}

interface PermRegistry {
  /** 精确签名（`METHOD 路由模板`）→ 权限编号 */
  exact: Map<string, number>;
  /** 带参数路由的模板匹配 */
  matchers: PermMatcher[];
}

let cache: Promise<PermRegistry> | undefined;

/** 把路由模板转成正则：`:param` 匹配单段，`*` 匹配剩余任意路径 */
function toPattern(template: string): RegExp {
  const source = template
    .split("/")
    .map((segment) => {
      if (segment.startsWith(":")) return "[^/]+";
      if (segment === "*") return ".*";
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${source}$`);
}

/** 接口签名（`METHOD 路由`）→ 权限编号，首次调用时从已注册路由建立并缓存 */
export function getPermRegistry(): Promise<PermRegistry> {
  cache ??= collectPermRoutes().then(({ permRoutes }) => {
    const exact = new Map<string, number>();
    const matchers: PermMatcher[] = [];
    for (const [code, route] of permRoutes) {
      const index = route.indexOf(" ");
      const method = route.slice(0, index).toUpperCase();
      const path = route.slice(index + 1);
      exact.set(`${method} ${path}`, code);
      if (path.includes(":") || path.includes("*")) {
        matchers.push({ method, code, pattern: toPattern(path) });
      }
    }
    return { exact, matchers };
  });
  return cache;
}

/**
 * 查询某个请求命中的权限编号（未声明返回 undefined）
 * @param method 请求方法
 * @param target 路由模板或实际请求路径
 */
export async function permCodeOf(
  method: string,
  target: string,
): Promise<number | undefined> {
  const { exact, matchers } = await getPermRegistry();
  const key = `${method.toUpperCase()} ${target}`;
  const hit = exact.get(key);
  if (hit !== undefined) return hit;
  for (const item of matchers) {
    if (item.method === method.toUpperCase() && item.pattern.test(target)) {
      return item.code;
    }
  }
  return undefined;
}
