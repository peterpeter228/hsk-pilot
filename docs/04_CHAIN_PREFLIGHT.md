# 04｜HSK主网预检、研究快照与可执行门禁

## 1. 必须先区分三类证据

1. **文档事实**：官方公布地址、网络参数、接口和心跳。
2. **只读链上研究快照**：特定区块确实能读取什么、有无代码、池是否存在、quote能否返回。此包附带的JSON仅属这一类。
3. **本项目运行验收**：本项目合约、源码验证、授权、真实执行回执、浏览器闭环和部署SHA。当前交接包没有这一类证据，所有相关字段保持null/NOT_RUN，Dot开发后填入。

快照可能很快过时；每次部署和LIVE会话启动前必须重新预检。成功的eth_call报价不是成交回执。

## 2. 本轮已经实际读到的结果

取证时间：2026-10-26 13:15:22–13:15:54（北京时间）；固定区块 **29,322,293**，区块时间13:15:21；区块hash **`0xadd56e5cac23ae2db45d4a86cafd171406d492abdd4ec4b0f3a602954820987a`**。

| 项目 | 只读结果 | 启动影响 |
|---|---|---|
| 主网RPC `https://mainnet.hsk.xyz` | chainId=177；该块gasLimit=30,000,000 | 网络配置成立；gasLimit是快照，不应当作不可变常量 |
| WHSK | 地址有代码，decimals=18 | raw amount按18位精度 |
| USDT | 地址有代码，decimals=6 | 1 USDT=1,000,000 raw，不是1e18 |
| SwapRouter02 | 有代码；factory()及WETH9()读值与候选一致；部署ABI为7字段exactInputSingle，不带deadline | deadline由Guard自己约束；不得换用旧8字段ABI |
| WHSK/USDT fee=3000 | `0x4ff515761864e7838b0adb8b5b2b8b7a068905dc`，token0=WHSK，token1=USDT；liquidity非零 | 作为B0默认候选池；需要后续双向/不同量级报价和fork交易 |
| WHSK/USDT fee=100/500/10000 | getPool均为零地址 | 不实现原稿fee500↔3000套利；本结论仅覆盖已检查四档，不声称所有自定义fee都不存在 |
| USDC/USDT fee=100/500/3000/10000 | getPool均为零地址 | 不作为现成备用直连交易对；本轮没有验证其他多跳路径 |
| QuoterV2，1 USDT→WHSK，fee3000 | 返回11.310419504889826878 WHSK | 是固定区块模拟报价，非成交、非盈利、非未来承诺 |
| APRO HSK/USD | decimals=8；answer=8,753,842；updatedAt=2026-10-25 18:51:09北京时间；age=66,252秒 | 对原定1小时新鲜度条件失败，B1=BLOCKED；此数值是陈旧历史报价，不作当前公允价格 |
| APRO USDT/USD | decimals=8；answer=99,890,000；age=10,074秒 | 在文档24h心跳范围内；不代表WHSK估值源正常 |
| WHSK/USDT 30分钟TWAP | `observe([1800,0])` revert `OLD`；cardinality=1 | 该快照无可用30分钟TWAP，不能作为现成独立Oracle替代 |
| EAS及SchemaRegistry | 有非空代理代码 | 仅证明代理地址有代码；未证明schema注册或attest成功，不纳入B0交易依赖 |

APRO HSK喂价还在dRPC同一固定区块交叉读取，raw结果一致。本轮曾遭遇RPC单请求403，之后同端点标准JSON-RPC batch读取成功；记录真实失败和成功，不能把暂时网络失败写成链不可用。

## 3. 地址来源与逐项提升可信度

地址配置必须包含address、chainId、sourceUrl、verifiedAt、fixedBlock、verificationLevel。文档候选不能直接标成“已实盘验证”。

| 资产/组件 | 候选地址（无脚注污染） | 本轮最高证据级别 |
|---|---|---|
| WHSK | `0xB210D2120d57b758EE163cFfb43e73728c471Cf1` | 官方目录 + code + decimals |
| USDT | `0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029` | 官方目录 + code + decimals |
| SwapRouter02 | `0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3` | 发布包 + explorer ABI + code + factory/WETH9 |
| V3Factory | `0x972cA9D1662F5e029cD18327D29026532E84c742` | 发布包 + router getter + code + getPool |
| QuoterV2 | `0x603f70466fDdbE3F238220B9a74FFF419a2BbFDD` | 发布包 + code +1 USDT quote |
| HSK/USD | `0x86CE42c1b714149Dc3A7b17169EF67b5F78A224b` | 官方目录 + code + ABI + decimals + latestRoundData，但陈旧 |
| USDT/USD | `0x823d7f90f7A3498DB6595886b6B5dC95E6B0B7f3` | 官方目录 + code + decimals + latestRoundData |
| EAS | `0x4200000000000000000000000000000000000021` | 官方目录 + 非空代理代码 |
| SchemaRegistry | `0x4200000000000000000000000000000000000020` | 官方目录 + 非空代理代码 |

本轮router的Blockscout字段为`is_verified=true`、`is_partially_verified=true`、`is_fully_verified=false`。不要把该第三方依赖写成“完全源码验证”。自己的部署必须另行验证。

## 4. Dot必须实现的preflight脚本

脚本只能读取；与broadcast脚本彻底分开。默认超时、有限重试，日志不含API key/私钥。输出机器可读JSON并给人读摘要；保存UTC和北京时间、git SHA、工具版本、endpoint别名、区块hash、每项pass/fail/unknown及原始错误。链上数量使用十进制字符串，避免JS Number精度丢失。

顺序：

1. 校验配置schema、20字节地址、chainId=177；读取`eth_chainId`、固定区块number/hash/timestamp，禁止跨区块混搭数据。
2. 对所有执行依赖读取`eth_getCode`，记录代码长度和fingerprint；如用SHA-256须明确命名`codeSha256`，不要冒充EVM keccak extcodehash。代理还需记录实现/管理员或其未知状态。
3. 读取router `factory()`、`WETH9()`，比对预期；核对真实部署ABI以及exactInputSingle selector。固定recipient为执行账户。
4. 从factory读取fee3000池，再核验token0/token1/fee/liquidity；liquidity是V3原始流动性数值，不能直接当美元TVL。
5. 从链上读取WHSK/USDT decimals，双向探测拟用金额及更小金额的quote，记录price impact和最小输出；不只验1USDT。
6. 在可访问的fork中以实际Guard调用路径做成功swap、滑点失败、旧签名失败、REDUCE_ONLY卖出、紧急提款。eth_call应使用实际caller和余额/授权语义，不能只调用一个mock router后称已集成主网。
7. B0：说明没有独立Oracle保护，检查owner已选择B0、预算和最坏拨入资金边界、quote新鲜度、会话版本、keeper运行与gas储备；L1/operator费用未确认字段应标unknown并采取保守gas预算。
8. B1：额外读取feed description/decimals/latestRoundData及访问控制，检查更新时间、正价、时间不在未来；从Guard调用路径验证访问权限；独立价格偏差与quote滑点分别评估。HSK源陈旧则阻止B1执行。
9. 检查数据库、幂等键、nonce租约/串行执行、receipt追踪、reorg恢复和worker健康。模拟通过后，广播前仍须再次检查quote和policy版本。

无需为本项目启用EIP-7702；Jovian支持相关特性不意味着采用它能自动获得安全会话权限。无需创建新池、注入自有流动性、调整Oracle参数或修改主网基础设施来使测试通过。

## 5. 门禁结果必须拆分

| 门禁 | 研究快照状态 | Dot完成后如何放行 |
|---|---|---|
| 文档/配置一致性 | 部分已验证 | 原稿脚注污染、chainId、compiler冲突已修复，新的lockfile与版本矩阵通过 |
| B0读取依赖 | 候选可用 | 最新双向quote、实际账户余额、fork路径、预算和签名检查全部通过 |
| B0主网花费 | NOT_AUTHORIZED / NOT_RUN | 用户实际授权B0模式和总预算；在已授权范围内完成部署与真实执行 |
| B1独立Oracle模式 | BLOCKED_STALE_HSK_FEED | 新鲜源通过完整核验，用户显式启用新版本；不能自动从B1回退B0 |
| 30分钟TWAP模式 | UNAVAILABLE_AT_SNAPSHOT | 重新验证历史窗口和持续可用性后才可单独设计，不自动放行 |
| 本项目源码验证/主网交易/浏览器闭环 | NOT_RUN | 真实项目部署、SHA、回执、事件、UI证据和复核记录齐备 |

把没有执行的项目检查标NOT_RUN，把无法访问的依赖标UNKNOWN/BLOCKED。单个需要凭证的检查不应阻止其余编码、mock/fork测试与文档整理。

## 6. 关键边界

- B0 P&L显示“USDT计价 / DEX报价估值”，USDT本身可能脱锚，不能把USDT金额无条件等同美元。
- 最新Quoter报价与RPC一致不能排除同一池被操纵；B0相应风险必须在能力说明中可见。
- `minOut`限制本次成交最低输出，不能保证资产未来价格或止损执行。
- keeper的阈值触发不等于保证最大回撤；进入REDUCE_ONLY后仍可能持仓未卖出，必须单独显示。
- B0/B1切换均由owner确认、关闭旧session并开启新session/新policy版本；后端不默默减弱保护以提高演示成功率。
- 向主网广播、拨入资金和支付gas需使用未来开发会话中已经有效的授权。本研究没有授予资金操作权限。

## 7. 证据源

官方网络、代币、Oracle、系统合约和升级页面分别为：

- <https://docs.hskchain.net/docs/Build-on-HashKey-Chain/network-info>
- <https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Token-Contracts>
- <https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Tools/Oracle>
- <https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Contract-Addresses>
- <https://docs.hskchain.net/docs/Notices/Jovian-Upgrade>

发布包与部署ABI来源见`docs/14_REVIEW_FINDINGS.md`。链上实际读取来源为`https://mainnet.hsk.xyz`与同区块交叉读取的`https://hashkey.drpc.org`；字段和原始eth_call响应摘要见`evidence/research_chain_snapshot.json`。未来完整preflight应生成自己的新文件，保留本研究快照作为历史，不覆盖成“验收证据”。
