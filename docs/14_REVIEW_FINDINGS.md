# 14｜原方案技术审查与必须修复项

核查日期：2026-10-26（Asia/Shanghai）。审查对象：用户上传《HSK黑客松AI代理开发方案.md》中的文字、地址表及示例合约。以下代码问题属于静态审查结论；本轮没有将该示例编译成可部署成品，没有部署、签名或发送交易。真实链上读取见 `evidence/research_chain_snapshot.json`。

## 1. 总体决定

保留自然语言策略控制、HSKSwap 上的自主交易闭环、链上执行限额、真实交易证据。重写示例合约，缩减为单 owner、不可升级、固定两资产、固定路由的执行账户。MVP 使用 **B0 / BOUNDED_EXECUTION**：以 USDT 原始整数计量预算，以真实 DEX 报价进行决策与估值。**B1 / ORACLE_GUARDED** 是显式增强模式，必须验证独立价格源新鲜可用后才能启用。

研究快照中的 APRO HSK/USD 已陈旧约18.4小时，原文件规定的1小时新鲜度条件无法满足。B1 因此阻塞；B0 采用的是不同且公开说明的信任模型，必须由 owner 显式选择，不能在 B1 失效后自动降级。B0 的限额与签名约束可以限制授权范围，但不证明报价公允，不提供价格操纵防护，不保证止损成交或资金保本。

## 2. P0：会阻止构建、交易或紧急退出

| ID | 原方案位置与问题 | 影响与修复 | 必须验证的回归条件 |
|---|---|---|---|
| F01 | 1.1–1.3 的纯文本脚注紧贴数值。例如 `1336` 中末尾6是引用编号，多处地址后跟7/9/10 | 复制后可能得到41/42位十六进制地址或错误 chain ID；不能从表格自动提取最终常量。网络实际测试网ID为133；所有地址采用独立字段和来源字段，做严格20字节、checksum/大小写规范、code检查 | 41位hex和“1336”必须被配置校验拒绝；不得自行截断后直接认定可信；重新从官方源和链上读取 |
| F02 | 强制 `solc 0.8.26` 同时 `evm_version="prague"` | 0.8.26的受支持目标到Cancun，不认识Prague。链升级与编译器能力是两个条件。选一个当前已核实、修复版本已检查的编译器并显式锁定EVM目标，提交lockfile；最小可行组合可采用支持Cancun的compiler+Cancun目标，实际选择记录ADR | CI、开发机及源码验证使用相同精确compiler、optimizer、viaIR、evmVersion；禁止仅改pragma而保留冲突工具配置 |
| F03 | `emergencyPause()` 把 `getPortfolioEquityUsd18()` 放进事件参数；`withdrawToken()` 转出后又调用同一估值 | 任意持仓对应Oracle陈旧、不可读或异常，可令整个暂停/提款事务回滚。紧急操作依赖失效依赖是设计错误 | 暂停只写状态、发基础事件；提款只由owner授权，暂停会话并失效旧授权，不依赖任何Oracle、Quoter、EAS或全资产枚举；Oracle恒revert时暂停和提款仍成功 |
| F04 | `requiredAgentQuorum` 无校验，可为0 | `_verifyAgentQuorum(intent, [], 0)` 返回，任何人可在其他约束内触发无签名交易。owner误配置即可造成授权丢失 | MVP固定必须含策略签名和风险签名，两者地址非零且不同；不使用任意2-of-3绕过风险角色。配置/构造阶段拒绝0、重复角色及不可达门限 |
| F05 | 示范套利依赖WHSK/USDT fee500和fee3000双池，默认又列USDC/USDT套利 | 实测标准fee100/500/3000/10000中WHSK/USDT只有3000存在；USDC/USDT四档均零地址。不存在的池不产生可执行套利，DEX与Oracle价差也不自动构成套利闭环 | 策略启动前读取getPool并验证token0/token1/fee/liquidity和双向报价；无池时显示UNAVAILABLE，不造模拟池地址、不标真实机会；MVP采用单池有限预算的执行策略 |
| F06 | 把官方公布的APRO心跳当作实际新鲜度保证 | 区块29,322,293实测HSK/USD `updatedAt` 为2026-10-25 18:51:09北京时间，较区块时间陈旧66,252秒；两个RPC结果一致 | B1独立Oracle新鲜度失败时停止新交易且显示准确原因；禁止延长maxAge到24h“修好”演示。B0只在用户事先明确选择后运行，并显示无独立价格保护 |
| F07 | 认为DEX TWAP可以直接替代失效APRO | 同一池30分钟 `observe([1800,0])` 实测revert `OLD`；observationCardinality=1。该快照并无可用30分钟TWAP | 任何TWAP方案均先验证窗口历史、持续观察、流动性和操纵假设，不能把spot/单次quote改名TWAP。B0无需声称存在TWAP保护 |
| F08 | 交易后HWM回撤检查仅revert，文档称“自动熔断/止损” | revert回滚交易内全部状态和事件，不能同时留下持久暂停；已经下跌的持仓可能因卖出后仍低于HWM而被拒绝退出。更没有保证成交于止损价 | 新状态为ACTIVE、REDUCE_ONLY、PAUSED；keeper先用独立事务成功进入REDUCE_ONLY，再签名/提交只减仓卖出。退出不要求回到旧净值高点。交易失败不清除REDUCE_ONLY |

## 3. P1：会错误核算风险、扩大攻击面或损害真实性

| ID | 问题 | 修复与验证 |
|---|---|---|
| F09 | 单笔交易额上限被当作仓位上限 | 多笔买入可无限累积库存。链上分别约束USDT单笔毛买入、会话累计毛买入、UTC日累计毛买入及WHSK raw库存上限。卖出所得不补回已用毛买入预算；100次小单也不能越过总预算 |
| F10 | 注释称“24h rolling/daily”，实现是 `timestamp/1 days` 的UTC日桶 | 明确只承诺UTC日累计，UI显示重置时间；会话总预算跨午夜不重置；若需要滚动24h须另设算法和测试，不能混称 |
| F11 | Policy更新不使旧TradeIntent显式失效 | nonce虽防重复执行，却不能表明提案基于哪版政策。签名包含sessionId、policyVersion/policyHash；修改策略、角色、暂停/重新启用、owner提款都失效旧提案；测试旧签名在政策变更后被拒绝 |
| F12 | `maxSlippageBps` 同时当报价滑点和Oracle公允价格偏差 | 二者含义不同，APRO约1h/24h更新也不是毫秒级成交价格。拆分`quoteSlippageBps`和B1的`maxOracleDeviationBps`；B0只声明前者。报价包含池手续费，预算估算不能重复或漏算 |
| F13 | whitelist取消后再次开启会重复push `trackedTokens` | 同一余额可被双重估值，HWM、回撤和资产净值失真。MVP只允许固定WHSK与USDT，不动态append列表；若扩展必须用唯一集合，估值清单和可交易清单分离 |
| F14 | 去掉whitelist即不计该资产估值；任意syncHWM会重置风险基准 | 风险状态可因管理配置而改变，存取款亦未进行现金流调整。关闭交易资格不能删除持仓负债记录；MVP按会话和现金流记录净值，owner不得在活动会话中无痕“洗掉”回撤 |
| F15 | `getTokenPriceUsd18` 假定feedDecimals≤18且无溢出/未来时间检查 | 配置时验证支持的decimals，算术采用显式尺度和mulDiv；检查answer>0、updatedAt>0、updatedAt≤block.timestamp、age≤上限，按实际feed语义决定round检查。过大精度/负值/未来时间/零时间均拒绝 |
| F16 | 钱包余额值与“已实现/未实现P&L”混用 | 示例合约没有成本基础、存款、提款、交易成本和已实现P&L状态，无法支持文案中的完整盈利指标。基于真实Transfer/receipt/执行事件建立账本，以USDT为计价单位；卖出实现盈亏、持仓DEX报价估值、外部现金流和gas成本分列；缺失显示unknown，不填0 |
| F17 | 只读取router返回amountOut，不核验账户余额差 | 正常标准V3路由可能可靠，但应用审计证据仍需真实balance delta。只支持已核实标准代币，排除fee-on-transfer/rebase；执行前后核验实际输入输出增减与接收账户，使用SafeERC20，精确approve并清零余量 |
| F18 | 无限策略字符串、动态资产枚举、EAS同步调用进入关键执行路径 | 放大gas和可用性依赖。strategyId用定长标识，摘要hash上链；交易事件先承担证据锚定；EAS属于后置可选增强，失败不能令核心交易/紧急退出不可用 |
| F19 | reasoningHash和双签被称为“可验证AI推理共识” | hash证明被提交记录的完整性，签名证明授权，均不证明推理正确、训练过程、模型独立性或盈利能力。记录结构化输入、决定、规则版本和简短理由，不索取/存储隐藏思维链；可复算内容哈希，披露角色是否共用模型/进程/运营方 |
| F20 | 未固定reasoningHash的编码规范 | JSON键顺序、数值精度、时间格式会使hash不一致。采用统一versioned schema与确定性序列化；所有链上数量用十进制字符串，明确算法；跨Solidity/TS至少一个golden vector |
| F21 | 把GasPriceOracle误当总费用查询器，仅算L1与L2 | OP Stack在Isthmus后可含operator fee，Jovian改其计算。以HSK链实际字段和回执核算L2执行、L1数据、可能operator成本；缺字段不得虚构，原生HSK成本和USDT计价估算分列，不以陈旧HSK/USD作实时美元成本 |
| F22 | “净收益>0”直接触发单腿交易，称套利 | 单笔买入只有敞口，不能锁定利润。跨池套利必须构成可成交闭环并扣除两腿费用/价冲/MEV/失败成本；MVP删掉套利获利承诺，采用有限风险预算的确定性执行策略，允许NO_TRADE |
| F23 | 5,000区块日志范围被定义为整条链硬规则 | 该限制属于RPC服务政策，不能从供应商条款推出链共识规则。采用可配置小批量、自适应缩小、断点续传、去重与重组处理；保存实际endpoint错误；不要为验证极限扫描海量历史 |
| F24 | 仅凭部署回执或Blockscout绿标判断工程完成 | 部署不是交易、源码验证不是审计。本轮router读证据仅显示partial verification而非full；新项目需精确记录自己的验证状态、交易回执、真实合约事件和浏览器操作，不能用第三方router状态当项目验收 |
| F25 | 原稿依赖“进入目录后自动触发CLI检查” | AGENTS文件提供指令，不自动执行CI门禁。需要明确脚本、PR检查、阶段证据与失败状态，写文档不等于运行过测试；避免把Codex CLI特性无条件映射到ChatGPT Dot |

## 4. 选定修正架构：B0基础执行 + B1独立Oracle增强

### 4.1 B0能实际约束什么

账户只允许WHSK和USDT，只调用经preflight验证的HSKSwap SwapRouter02，并固定经过验证的fee3000池。每笔均要求策略角色与确定性风险角色签署同一结构化intent；角色地址必须不同，风险角色不能被任意多签组合代替。资金回到执行账户，禁止任意recipient、任意calldata、delegatecall、闪电贷、借贷、杠杆和升级入口。

输入USDT的买入分别受单笔、UTC日和会话累计**毛买入预算**约束；卖出不冲回预算。WHSK卖出按原始整数单位限定可卖量且不能超过持仓。链上执行deadline、nonce、策略版本、冷却、minOut、状态与资产边界；风险服务在固定区块读取真实quote、核验期限和允许滑点。多RPC仅验证链数据一致性，不能描述为多个独立价格源。

止损由keeper观察USDT计价的DEX估值后触发，状态先持久进入REDUCE_ONLY，再尝试卖出WHSK换回USDT。流动性不足、价格跳跃、网络故障或gas不足仍可能使卖出失败；UI必须展示这些状态。owner随时可暂停和提款，提款先失效所有旧签名并暂停活跃会话。

允许小额主网演示的前置条件：B0风险边界已展示、用户已明确授权该模式和实际预算、核心测试及固定区块fork交易通过、最新quote和实际余额正常。仅因为本次研究查到可报价，不能认定未来可成交，也不能代表用户已授权花费。

### 4.2 B1的额外要求

在B0全部限制上增加新鲜独立Oracle的价格偏差校验；不要以Oracle偏差替代执行滑点，也不要在Oracle故障时退化为B0。转换模式须owner确认、关闭旧session并开启新session/新policy版本。应检查代理及实现、feed description/decimals、访问控制、latestRoundData、更新历史、陈旧条件、稳定币脱锚和来源覆盖范围。仅EOA直接读成功不足以证明Guard合约调用可读，必须在fork中从Guard路径调用。

本研究快照B1为BLOCKED。不要在README中宣称已具备独立价格操纵保护；只有该增强真的完成并通过对应测试，才能改变能力表。

## 5. 最低回归集

用有业务含义的用例验证，不以堆测试数量代替验收：

1. 零/错误/重复/缺少风险角色签名、错误chain/domain/account、过期deadline、重复nonce、旧policy签名全部拒绝。
2. 超单笔、超会话总毛买入、跨UTC午夜尝试超会话总额、循环买卖企图恢复预算均拒绝。
3. PAUSED无自主交易；REDUCE_ONLY只允许WHSK→USDT、不得增加WHSK库存；风险触发后失败卖出不恢复ACTIVE。
4. Oracle永久revert、Quoter失败、EAS失败时，owner暂停和提款仍可完成。
5. 被操纵的spot/quote不能被展示成独立公允价；B0能力页准确提示该限制。B1的旧价/零价/未来价/异常precision全部拒绝且不降级。
6. 交易前quote成功、广播前环境改变导致revert：余额与nonce未错误提交，gas记账准确，重试不重复下单。
7. P&L包含买入、卖出、部分卖出、存款、提款、失败交易gas和价格陈旧；金额都使用整数/定点，禁止浮点参与签名。
8. 正常完成“自然语言→参数预览→owner确认→自主观察→风险批准→Guard执行→真实回执→持仓/P&L更新”；截图与录像可复现，但不将合成行情声称为主网市场事件。

## 6. 一手资料及证据范围

- 网络官方资料：<https://docs.hskchain.net/docs/Build-on-HashKey-Chain/network-info>（主网177、测试网133）。
- 官方代币目录：<https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Token-Contracts>。
- 官方Oracle目录：<https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Tools/Oracle>（地址/公布心跳，不能证明当前更新正常）。
- 官方系统合约目录：<https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Contract-Addresses>。
- 官方Jovian公告：<https://docs.hskchain.net/docs/Notices/Jovian-Upgrade>（公布2026-07-29主网升级时间及Isthmus特性）。
- Solidity 0.8.26 compiler目标：<https://docs.soliditylang.org/en/v0.8.26/using-the-compiler.html>；Prague默认变化：<https://www.soliditylang.org/blog/2025/05/07/solidity-0.8.30-release-announcement/>。
- Uniswap原始ABI：<https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol>（7字段）；部署ABI：<https://hashkey.blockscout.com/api/v2/smart-contracts/0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3>。
- HSKSwap发布包中的地址定义：<https://unpkg.com/@hskswap/sdk-core@1.0.3/dist/sdk-core.cjs.development.js>；router使用方式：<https://unpkg.com/@hskswap/smart-order-router@1.0.1/build/main/util/addresses.js>。本轮直接读取了发布包，不再仅继承第三方Sentinel项目的断言；这些地址仍需链上身份核验。
- APRO HSK proxy ABI：<https://hashkey.blockscout.com/api/v2/smart-contracts/0x86CE42c1b714149Dc3A7b17169EF67b5F78A224b>；USDT精度API：<https://hashkey.blockscout.com/api/v2/tokens/0xf1b50ed67a9e2cc94ad3c477779e2d4cbfff9029>；WHSK精度API：<https://hashkey.blockscout.com/api/v2/tokens/0xB210D2120d57b758EE163cFfb43e73728c471Cf1>。
- OP Stack费用模型：<https://docs.optimism.io/op-stack/transactions/fees>。具体HSK参数以实际链状态/回执为准。
- 原始代码逻辑缺陷来自用户附件，不能把“官方链文档”误引为该自定义合约的审计通过证明。

