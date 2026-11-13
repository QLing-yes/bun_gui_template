# Elysia 2 作用域（Scope）完整笔记

> 适用版本：Elysia 2
> 主要来源：https://next.elysiajs.com/essential/plugin

---

## 0. 核心思路

Elysia 的每个实例都是一个相对独立的小应用。生命周期 hook 默认**封装在实例内部**，插件里写的 hook 不会自动影响引入它的父应用。

想让 hook 传到外面，就要显式声明作用域。这样做的好处是：插件不会悄悄改变别人的行为，读代码时也能看出某个 hook 会影响哪些路由。

Source: https://next.elysiajs.com/essential/plugin#scope

---

## 1. 三种作用域

作用域写在 hook 的第一个参数，默认是 `local`，可以省略。

```ts
onBeforeHandle('local' | 'plugin' | 'global', fn)
onBeforeHandle(fn) // 等同于 'local'
```

| 作用域 | 影响范围 |
|---|---|
| `local`（默认） | 当前实例及其子孙 |
| `plugin` | 当前实例、子孙，以及直接父实例 |
| `global` | 所有使用了该插件的祖先实例 |

hook 返回空值时只是副作用，路由仍然返回自己的结果。

Source: https://next.elysiajs.com/essential/plugin#scope

---

## 2. 树形示例

以下示例在官方文档中使用，后面的说明都基于它：

```ts
const child   = new Elysia().get('/child', 'hi')
const current = new Elysia()
    .onBeforeHandle(SCOPE, () => console.log('hi'))
    .use(child)
    .get('/current', 'hi')
const parent  = new Elysia().use(current).get('/parent', 'hi')
const main    = new Elysia().use(parent).get('/main', 'hi')
```

结构关系：`main` → `parent` → `current` → `child`。

| Scope | /child | /current | /parent | /main |
|---|---|---|---|---|
| `local` | ✅ | ✅ | ❌ | ❌ |
| `plugin` | ✅ | ✅ | ✅ | ❌ |
| `global` | ✅ | ✅ | ✅ | ✅ |

`/child` 在三种作用域下都会执行，因为它是 `current` 的子实例，`local` 已经覆盖到了。

Source: https://next.elysiajs.com/essential/plugin#scope

---

## 3. 注册顺序与 `.use()` 的边界

- **注册顺序很重要**：hook 只作用于注册在它之后的路由或插件。
- **`.use()` 共享的 hook 不会回溯**：接收方实例上已经注册好的路由，不会被追加这个 hook。

Source: https://next.elysiajs.com/essential/plugin#scope

---

## 4. Global 作用域与去重（Dependency）

插件如果没有名字，每次被 `.use()` 时它的 hook 都会重新注册。给插件加上 `name` 后，Elysia 会按名字去重。

```ts
const ip = new Elysia({ name: 'ip' })
    .derive('global', ({ server, request }) => ({
        ip: server?.requestIP(request)
    }))
```

- `'global'` 表示该 hook 作用于所有直接或间接使用这个插件的实例。
- 同名插件即使被多次注册，hook 也只注册一次，每个请求只执行一次。
- `requestIP` 需要服务器适配器提供 `server`，否则 `ip` 为 `undefined`。
- **配置型插件**：用 `seed` 区分实例。`name` + `seed` 相同则去重，`seed` 不同则视为不同插件。

```ts
new Elysia({ name: 'version', seed: value })
```

> 注意：`name` 只去重注册，工厂函数每次调用仍会执行。一次性的工作应放在工厂函数之外。

### Global 还是 Explicit？

| Global（`.use` 一次，全局生效） | Explicit（每个实例自己 `.use`） |
|---|---|
| 不带类型的插件：CORS、压缩、安全响应头 | 会添加类型的插件：macro、state、models |
| 全局 hook：链路追踪、日志 | 业务依赖：认证、数据库、store、session、ORM/ODM 模型、功能模块 |

默认优先使用 Explicit，只有确实需要全局时再用 Global。

Source: https://next.elysiajs.com/essential/plugin#dependency

---

## 5. Scope Cast（提升作用域）

已经注册好的 hook 和 schema，可以通过 scope 字符串往父级"提升"。有三种写法：

### 5.1 Inline：只作用于单个 hook

```ts
const plugin = new Elysia()
    .derive('plugin', () => ({ hi: 'ok' }))
    .get('/child', ({ hi }) => hi)

const main = new Elysia()
    .use(plugin)
    .get('/parent', ({ hi }) => hi) // hi 可用
```

### 5.2 Guard：一组 hook 和 schema 一起作用域

```ts
const plugin = new Elysia()
    .guard('plugin', {
        response: t.String(),
        beforeHandle() { console.log('ok') }
    })
    .get('/child', 'ok')

const main = new Elysia()
    .use(plugin)
    .get('/parent', 'hello') // response schema 和 hook 都生效
```

> 需要带类型的派生属性时，用 `.derive('plugin', cb)`，不要用 guard。

### 5.3 Instance：`.as()` 提升已注册的内容

`.as()` 会提升当前实例上已经注册的 hook 和 schema，但**只能到达一层父级**。

```ts
const plugin = new Elysia()
    .derive(() => ({ hi: 'ok' }))
    .get('/child', ({ hi }) => hi)
    .as('plugin')

const main = new Elysia()
    .use(plugin)
    .get('/parent', ({ hi }) => hi) // hi 可用
```

如果要继续往上提升，需要在父级也调用 `.as()`：

```ts
const plugin = new Elysia()
    .guard({ response: t.String() })
    .onBeforeHandle(() => { console.log('called') })
    .get('/child', 'ok')
    .as('plugin')

const instance = new Elysia()
    .use(plugin)
    .get('/parent', 'still ok')
    .as('plugin')

const parent = new Elysia()
    .use(instance)
    .get('/grandparent', 'also ok') // string response schema 可以到达这里
```

路由返回 number 会违反 `response: t.String()`。TypeScript 会报错，运行时的 response 校验也会拦截。

Source: https://next.elysiajs.com/essential/plugin#scope-cast

---

## 6. Elysia 2 的相关变化

- **guard 的 schema 合并规则**：路由自己的 schema 默认会替换 guard 中同名的 schema。如果两者都要生效，在 guard 里写 `schema: 'merge'`。
  - 详见 https://next.elysiajs.com/essential/validation/#merge
  - Source: https://next.elysiajs.com/essential/plugin#guard
- **`app.store` getter 已移除**：读取 state 改用 handler 上下文里的 `store`。
  - Source: https://next.elysiajs.com/essential/plugin#config

---

## 7. 参考链接

- [Plugin](https://next.elysiajs.com/essential/plugin#plugin)
- [Dependency](https://next.elysiajs.com/essential/plugin#dependency)
- [Scope](https://next.elysiajs.com/essential/plugin#scope)
- [Config](https://next.elysiajs.com/essential/plugin#config)
- [Guard](https://next.elysiajs.com/essential/plugin#guard)
- [Scope cast](https://next.elysiajs.com/essential/plugin#scope-cast)
- [Lazy load](https://next.elysiajs.com/essential/plugin#lazy-load)
- [Validation - merge](https://next.elysiajs.com/essential/validation/#merge)
