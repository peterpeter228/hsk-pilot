# 11 部署、运行与恢复

## 1. 发布顺序

本地mock → 固定block fork → 当前主网只读预检 → 主网动作预览与授权核对 → 部署暂停状态的Guard → 源码验证 → Web/worker部署并只读核对 → owner小额拨入/会话授权 → 有限自主运行 → 退出与证据整理。

禁止把“合约能deploy”放在合约资金测试之前。部署hash、构造参数、编译metadata与源码SHA须一致，secret不得进部署日志或仓库。

## 2. 版本与工具链

G0锁定pnpm/Node/Next/Viem/Wagmi/OpenZeppelin/Foundry/solc及EVM target的确切版本。锁文件进入Git，CI使用frozen lockfile。编译器 target 不一定追最新协议，必须明确支持与测试；记录optimizer/viaIR以保证Blockscout复现。

只读研究证明SwapRouter02 ABI字段，但项目自己的部署仍需重新生成artifact与constructor参数。Blockscout部分验证与完全匹配不能混同；对本项目合约争取完整源码匹配，未完成时据实显示。使用官方Blockscout Foundry验证说明，不借用另一条链的配置作为真值。

## 3. secrets与签名

owner主钱包始终由用户钱包持有；部署使用已授权专用账户/keystore。strategy/risk密钥分别配置在worker签名边界，只能签固定typedData；relayer账户只保留授权gas额度。不要在聊天中粘贴私钥、将私钥放命令行参数/浏览器本地存储/截图，或把NEXT_PUBLIC用于任何secret。

部署脚本默认dry-run，广播需要显式选项和当前授权状态。env存在private key不等于无限交易许可。用户已有授权足够则不重复询问，优先复用具体批准的预算/资产/有效期。

## 4. 托管

Web可独立公开只读Demo；worker是常驻进程；数据库持久化。不要把自动交易loop放短生命周期serverless路由或浏览器setInterval。

若采用Render：确认web端口、health、build/start命令、worker重启策略、secret配置、DB连接与费用。若采用Supabase Postgres：只用专用项目或隔离schema，迁移可追踪，service-role仅服务端，公开读数据不包含签名素材；owner写表不能由匿名客户端直接修改。

选择和建立新资源依赖当轮可用插件与用户授权。先读相应Render/Supabase技能，再操作。现成连接并不授权改无关项目或创建任意付费服务。

## 5. CI建议

pull request运行类型/业务单测、合约构建及关键fuzz、production build；固定fork放独立job，RPC不可用显示BLOCKED不冒充通过。main发布前跑浏览器核心smoke和证据一致性。

不要每次PR自动主网deploy或自动拨钱。主网写操作是独立手动触发流程且验证artifact SHA。无真实凭证的PR也要能测试mock模式。CI artifacts只保留必要日志、失败trace和最终证据，避免无意义大视频占满存储。

## 6. 健康与告警

health区分web ready、worker heartbeat、lastProcessedBlock、RPC lag、DB、signer、gas余额、mode与session。worker错过heartbeat时UI显示“自主运行中断”，不继续动画暗示正常。报价/Oracle来源失效给确切reason，不能自动增大滑点恢复。

产品内告警含累计预算、模型/RPC开销、待确认时间、退出失败。主动向外发送邮件/Telegram另需用户明确授权，不能从“上线产品”推导为允许联系第三方。

## 7. 故障手册

| 故障 | 行动 |
|---|---|
| RPC超时/区块不同 | 暂停签新意图；交叉读同block；不要绕过时效 |
| worker重启 | 加锁、读取chain nonce与pending、恢复旧job后再扫描 |
| nonce冲突 | 查询pending/receipt/replacement，不能简单nonce++重新下单 |
| tx超时 | RECONCILING；保持同意图身份；只有确认旧交易未执行/被替换才重试 |
| Oracle stale | B1停止新交易；owner仍可暂停/提款；不可静默B0 |
| quote变差/流动性少 | HOLD或退出失败；不自动减minOut到0 |
| 演示前页面服务掉线 | 展示明确时间的已录真实视频及证据，不能称实时 |
| Guard发现P0缺陷 | owner暂停、取回、废弃旧部署；新地址新session，旧链接标退役 |
| 数据库丢失 | 从链上事件及证据恢复，LLM摘要缺失据实标缺，不发明历史 |

## 8. 退出与交付

有限演示结束时按owner批准计划停止会话并回收余额；不默认让交易无限运行。保留实际支出、余额、未确认交易、allowance和最终policy状态。不可升级合约不能“回滚代码”，修复时重新部署并迁移owner明确批准的会话。

最终交付包含仓库/branch/SHA、可访问Demo、Guard/chain/部署receipt、版本矩阵、主网交易证据、浏览器验收、已知局限和未完成项；所有链接必须实际打开检查。

来源：[Blockscout Foundry验证](https://docs.blockscout.com/devs/verification/foundry-verification)；具体托管命令在Dot执行时按当前官方文档与技能核对。
