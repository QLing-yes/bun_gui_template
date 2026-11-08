// 鉴权测试页：sidecar token 链路验证（仅桌面端路由注入）

import { useState } from "react"

import { PageCard } from "@/components/page-card"
import { Button } from "@/components/ui/button"
import {
  CodeBlock,
  CodeBlockActions,
  CodeBlockContent,
  CodeBlockCopyButton,
  CodeBlockHeader,
  CodeBlockTitle,
} from "@/components/ui/code-block"
import { Spinner } from "@/components/ui/spinner"
import { client } from "@/lib/api"

export function TestTokenPage() {
  /** 请求进行中标志（按钮禁用 + Spinner） */
  const [loading, setLoading] = useState(false)
  /** 请求结果文本（成功信封或错误信息） */
  const [result, setResult] = useState("")

  /** 测试 sidecar token 鉴权链路：error 分支表示 HTTP/校验失败，成功则显示信封内容 */
  const testToken = async () => {
    setLoading(true)
    setResult("请求中... POST /success")
    try {
      const { data, error, status } = await client.api.success.post()
      setResult(
        error
          ? `HTTP ${status}\n${JSON.stringify(error.value, null, 2)}`
          : `${status} OK\n${JSON.stringify(data, null, 2)}`
      )
    } catch (err) {
      setResult(`请求失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <PageCard
      title="Sidecar 鉴权测试"
      description="验证桌面端 sidecar token 注入链路"
    >
      <Button variant="secondary" disabled={loading} onClick={testToken}>
        {loading && <Spinner data-icon="inline-start" />}
        测试 Token 调用 POST /success
      </Button>
      {result && (
        <CodeBlock size="sm" className="w-full">
          <CodeBlockHeader>
            <CodeBlockTitle>响应内容</CodeBlockTitle>
            <CodeBlockActions>
              <CodeBlockCopyButton value={result} />
            </CodeBlockActions>
          </CodeBlockHeader>
          <CodeBlockContent wrap>{result}</CodeBlockContent>
        </CodeBlock>
      )}
    </PageCard>
  )
}
