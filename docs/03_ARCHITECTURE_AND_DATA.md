# 03 系统架构与数据契约

## 技术路线

采用 pnpm monorepo、TypeScript、React/Next.js Web、常驻 Node worker、PostgreSQL、Viem/Wagmi、Foundry 和 OpenZeppelin 的经锁定稳定版本。Dot 在 G0 核对可用工具、包兼容性和已知问题后锁定确切版本；不要机械沿用附件的 Next.js 15 或 solc0.8.26+prague。

合约可使用受支持的稳定 solc + 明确的兼容 EVM target；优先普通存储 ReentrancyGuard，不为此任务启用 transient storage、EOF、7702。G1 本地编译及主网 fork 验证该组合，再冻结编译器、optimizer、viaIR、evmVersion用于源码验证。

默认部署拓扑：一个 Web 服务、一个常驻 worker、一套持久 PostgreSQL。优先复用已授权的 Render 与隔离的 Supabase/Postgres资源；缺资源时先 Docker 本地完成，不擅自选付费套餐或访问无关数据。产品不依赖浏览器标签页保持打开才能交易。

## 目录责任

| 路径 | 职责 |
|---|---|
| contracts | Guard、固定Router接口、测试与部署脚本 |
| packages/shared | JSON schemas、EIP-712类型、金额单位、状态枚举、错误码 |
| packages/chain | 经验证registry、只读RPC、quote、receipt与reorg处理 |
| packages/strategy | deterministic候选生成、LLM结构化选择、风险检查 |
| apps/worker | 调度、签名边界、广播、索引、对账、退出keeper |
| apps/web | 只读Demo、owner操作、自然语言计划与证据浏览 |
| migrations | PostgreSQL建表与唯一约束 |
| scripts | doctor、preflight、证据verify/export、演示与部署预览 |
| evidence | 研究快照与未来各门禁证据，分目录不覆盖 |

## 运行边界

owner 钱包掌管拨入资金、开始/更新/结束 session、暂停与提款。StrategyAgent 可访问快照及合法候选，不接触链上私钥。RiskEngine 是确定性组件；签名服务验证策略输出及风险结果后分别使用 strategy 和 risk 的受限密钥。外部API、网页、token metadata、LLM文本都不能直接变成调用目标/收款人。

双角色密钥是逻辑职责分离。若共用宿主进程、管理员或secret store，明确披露存在共同失陷风险；不能表述成两个独立机构审计或去中心化共识。签名服务不签任意EIP712结构，只接受项目的TradeIntent schema；risk角色另有唯一白名单链上动作Guard.enterReduceOnly，只能收紧权限，需在授权gas预算中预留其费用，不能提款或恢复ACTIVE。

浏览器无私钥；owner通过钱包发链上交易。API只读为默认；公开judge入口不能控制worker、预算或签名。owner的后端登录应绑定钱包nonce、域、chainId、短期有效期及会话，状态变更要求身份校验与CSRF防护。仅凭浏览器传入owner地址不算身份验证。

## 数据流

1. Monitor 拉取同一固定区块的 pool、余额、policy、quote，记录 blockHash 和来源；近期历史用可回滚索引而非全历史扫链。
2. CandidateBuilder 用整数算法产生 HOLD 和至多一个方向的合法交易候选；金额受owner policy限制。
3. Strategy LLM 返回候选ID/缩减比例/简短依据；禁止新增资产、提高金额、改policy、生成calldata。
4. RiskEngine读取最新policy/version、重新获取整笔报价并完成静态风险检查，构建pre-trade commitment及最终typedData，两个角色签署同一intent。
5. Coordinator原子预留任务与nonce，对带完整两角色签名的确切Guard调用做eth_call；通过后再次检查policy/quote时效再广播，并持久化raw交易hash；收到receipt后核对事件/余额/目标。静态预检不能声称已完整模拟。
6. Indexer更新positions、成本与PnL，证据导出与UI基于同一真值；模型口述不能覆盖账本。
7. Stop keeper独立运行；确认触发后先发enterReduceOnly，确认持久状态，再发减仓。

## 数据实体与约束

所有raw数量、价格缩放整数、链上nonce使用十进制字符串/API bigint；数据库NUMERIC或TEXT需有数值格式约束，禁用浮点。时间存UTC，UI显示明确时区。

| 实体 | 核心字段 | 唯一约束/说明 |
|---|---|---|
| deployments | chainId,address,codeHash,sourceSha,compiler,mode | chainId+address |
| sessions | account,sessionId,policyVersion,mode,status,startBlock,endBlock | account+sessionId |
| policies | fullPolicy,hash,ownerTxHash,effectiveBlock | account+sessionId+version |
| snapshots | blockNumber,blockHash,source,poolState,quotes,observedAt | snapshotHash |
| decisions | modelProvider/modelId,promptHash,inputHash,candidate,reasonSummary,tokens,cost | decisionId |
| intents | canonicalTypedData,intentHash,policyVersion,status,signerAddresses | intentHash及account+session+nonce |
| transactions | txHash,from,txNonce,receiptStatus,canonicalBlock,fees | chainId+txHash；replacement关联原tx |
| fills | intentHash,tokenIn/out,rawIn/out,logIndex | chainId+txHash+logIndex |
| flows | deposit/withdraw/allocation/surplus,valueSource | chainId+txHash+logIndex |
| observations | markedEquity,pnl,quoteAge,quality,costs | session+blockHash+method |
| audit_events | id,type,subject,sourceHash,createdAt | append-only；不得存密钥 |

## 幂等与重组

同一account只允许一个广播者。Postgres事务/锁负责领取job与nonce；同session只保留一个待执行intent。任何重启先读nonce、receipt、pending和policy，不从“未显示成功”推断“未广播”。

采用链上intent nonce与EOA交易nonce两套状态；替换交易保留同一EOA nonce，记录replacement链。数据库把旧intent标为废弃不等于链上撤销：已发出的双签在deadline之前仍可能被提交。P0重新报价遵守单pending规则，先确认旧intent已消费或过期，再发新的签名；需要立即撤销则owner提高policyVersion或合约显式invalidateNonce，并确认生效后再签。不用同nonce同时发布多组不同有效签名，不能把本地取消显示为链上撤销。

索引按blockHash保存，回滚到共同祖先后重放；已展示确认状态发生reorg立即撤回。若RPC支持safe/finalized便记录具体tag，不把“等待N个块”称为L1最终性；若不支持，展示确认数和限制。

## 错误优先级

链错误/代码不符/账户不符 → 禁止任何写操作；报价过期/无流动性/LLM异常 → HOLD且不签；Oracle stale仅阻断ORACLE_GUARDED；未知交易状态 → reconciliation；policy更新 → 取消旧intent；owner暂停/过期 → 停普通交易，保留owner退出能力。

## 成本与调用

区块监听或适度HTTP轮询仅做轻量读；完整quote按候选需要调用，按provider实际限额分页。LLM只在新的有效候选或重要状态变化调用；同快照/政策复用结果而不反复辩论。缓存不能越过quote有效期或政策版本。记录RPC、LLM、链上gas、重试和耗时，使成本可评估。
