// 登录页（login-03 风格）：用户名+密码表单；校验预留，任意凭据直接通过

import { useRef, useState } from "react"
import type { RefObject } from "react"
import { useNavigate } from "react-router"

import { BRAND_NAME, BrandLogo } from "@/components/brand-logo"
import { AppIcon } from "@/components/icons"
import { ChromeActions, ChromeGroup } from "@/components/layout/chrome-group"
import { IconAction } from "@/components/layout/icon-action"
import { ThemeMenu } from "@/components/layout/theme-menu"
import { WindowDragRegion } from "@/components/layout/window-drag-region"
import { StaggerReveal } from "@/components/stagger-reveal"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useHistoryNav } from "@/hooks/use-history-nav"
import { isTauri } from "@/lib/tauri"
import { shake } from "@/lib/motion"
import { useAuthStore } from "@/store/auth"

/** 各字段错误文案；无错时对应键为 undefined */
type FormErrors = { username?: string; password?: string }

/** 校验用户名与密码 @param username 用户名 @param password 密码 @returns 各字段错误文案 */
function validate(username: string, password: string): FormErrors {
  const errors: FormErrors = {}
  const name = username.trim()
  if (!name) errors.username = "请输入用户名"
  else if (name.length < 2) errors.username = "用户名至少 2 个字符"
  if (!password) errors.password = "请输入密码"
  else if (password.length < 6) errors.password = "密码至少 6 位"
  return errors
}

/** 输入焦点态：边框 + 2px 环叠出厚度，颜色取低透明度显浅（覆盖基类 border-ring 深环） */
const INPUT_FOCUS_CLASS =
  "focus-visible:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring/15"

/** 登录字段参数（用户名/密码同构，故合并成一个页内组件） */
type LoginFieldProps = {
  /** 字段 id：label htmlFor 与 input id 共用 */
  id: string
  /** 字段中文名 */
  label: string
  /** 占位文案 */
  placeholder: string
  /** 输入类型（密码框传 password） */
  type?: string
  /** 浏览器自动填充提示 */
  autoComplete: string
  /** 当前值 */
  value: string
  /** 该字段错误文案（无错为 undefined） */
  error?: string
  /** 输入框 ref：校验失败时抖动定位用 */
  inputRef: RefObject<HTMLInputElement | null>
  /** 值变化 @param value 新值 */
  onValue: (value: string) => void
  /** 清掉该字段错误（输入即清，避免错了还挂着红框） */
  onClearError: () => void
}

/** 单字段行：Field(data-invalid) + 标签 + 输入 + FieldError（官方原语组合，手写校验状态） */
function LoginField({
  id,
  label,
  placeholder,
  type,
  autoComplete,
  value,
  error,
  inputRef,
  onValue,
  onClearError,
}: LoginFieldProps) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        ref={inputRef}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        className={INPUT_FOCUS_CLASS}
        value={value}
        onChange={(e) => {
          onValue(e.target.value)
          onClearError()
        }}
      />
      <FieldError>{error}</FieldError>
    </Field>
  )
}

/** 返回入口：能后退就后退（回到退出登录前的页面），直达登录页时兜底进主界面 */
function LoginBackButton() {
  const navigate = useNavigate()
  const { canGoBack } = useHistoryNav()

  return (
    <IconAction
      hint={canGoBack ? "返回上一页" : "进入主界面"}
      button={{
        onClick: () => {
          if (canGoBack) navigate(-1)
          else {
            navigate("/", { replace: true })
          }
        },
      }}
    >
      <AppIcon name="arrowLeft" size={16} />
    </IconAction>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<FormErrors>({})
  /** 校验失败的输入框：抖动一下作即时反馈 */
  const usernameRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  /** 提交：校验通过后走预留登录并回主界面（replace 避免后退又回到登录页） */
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = validate(username, password)
    setErrors(next)
    if (next.username || next.password) {
      shake(
        [
          next.username ? usernameRef.current : null,
          next.password ? passwordRef.current : null,
        ].filter((el): el is HTMLInputElement => el !== null)
      )
      return
    }
    login(username.trim())
    navigate("/", { replace: true })
  }

  // 滚动容器是页面根本身（主干 overflow 恒 hidden，文档不滚）：矮窗口下内容可滚到
  return (
    <div className="bg-dots relative h-svh overflow-y-auto bg-shell">
      <div className="flex min-h-full flex-col items-center justify-center gap-6 p-6 pt-12 md:p-10">
        {/* 桌面端：返回 + 顶部拖动区 + 主题菜单 + 窗口三键；浏览器：左上返回、右上悬浮主题入口 */}
        {isTauri ? (
          <div className="fixed inset-x-0 top-0 flex h-titlebar select-none">
            {/* 左上：返回入口（no-drag 保持可点击） */}
            <ChromeGroup side="left">
              <LoginBackButton />
            </ChromeGroup>
            <WindowDragRegion />
            <ChromeActions />
          </div>
        ) : (
          <>
            <div className="fixed top-1.5 left-2 [-webkit-app-region:no-drag]">
              <LoginBackButton />
            </div>
            <div className="fixed top-1.5 right-2 [-webkit-app-region:no-drag]">
              <ThemeMenu />
            </div>
          </>
        )}

        <StaggerReveal className="relative flex w-full max-w-sm flex-col gap-6">
          {/* 品牌区：logo + 名称 */}
          <div className="flex items-center gap-2 self-center font-medium">
            <BrandLogo />
            {BRAND_NAME}
          </div>

          {/* 卡片+光晕容器：光晕衬于卡片左下，透出磨砂层次 */}
          <div className="relative">
            {/* 渐变光晕：原生 400x457 图衬在卡片之下，位置/旋转/缩放均以其中心为锚，偏移量见类 */}
            <div
              className="bg-gradient pointer-events-none absolute -top-30 -left-15 h-[457px] w-100 scale-125 rotate-3 bg-no-repeat"
              aria-hidden
            />
            {/* 卡片衬在壳色上：磨砂背景由 index.scss 全局规则统一提供（含模糊） */}
            <Card className="relative rounded-t-2xl border-b border-solid border-separator px-3">
              <CardHeader className="text-center">
                <CardTitle className="text-xl">登录账号</CardTitle>
                <CardDescription>输入用户名和密码登录</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onSubmit}>
                  <FieldGroup>
                    <LoginField
                      id="username"
                      label="用户名"
                      placeholder="请输入用户名"
                      autoComplete="username"
                      value={username}
                      error={errors.username}
                      inputRef={usernameRef}
                      onValue={setUsername}
                      onClearError={() =>
                        setErrors((prev) => ({ ...prev, username: undefined }))
                      }
                    />
                    <LoginField
                      id="password"
                      label="密码"
                      placeholder="请输入密码"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      error={errors.password}
                      inputRef={passwordRef}
                      onValue={setPassword}
                      onClearError={() =>
                        setErrors((prev) => ({ ...prev, password: undefined }))
                      }
                    />
                    <Field>
                      {/* 亮档近黑由 primary 令牌提供（≈#191919），暗档自动反白；仅保留略重的悬停档 */}
                      <Button type="submit" className="w-full hover:bg-primary/90">
                        登录
                      </Button>
                    </Field>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </div>
        </StaggerReveal>
      </div>
    </div>
  )
}
