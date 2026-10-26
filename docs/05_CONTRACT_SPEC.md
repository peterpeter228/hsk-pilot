# 05 TradingSessionGuard 合约实现规格

这是待实现的行为契约，不是经审计合约代码。原附件示例不得直接部署。所有资金操作只对owner自有受限资本，不开放公共存款池、不发行份额、不借贷、不提供平台托管服务。

## 1. 固定边界

每个不可升级 Guard 对应一个 owner；Ownable2Step用于未来owner转移时，转移必须关闭会话并撤销旧签名。router、factory、riskToken=WHSK、quoteToken=USDT、pool地址、fee等经 G1 确认后固定。recipient恒为Guard本身，不能从intent传入任意地址。

禁用renounceOwnership，防止资金永久失主。发起转移即停会话，pendingOwner期间禁止开新会话；acceptOwnership实际生效时再次关闭会话并失效旧签名，再赋予新owner权限。owner变更不是普通策略更新。

仅支持经验证的普通ERC20。token decimals在初始化核对并固定；不支持fee-on-transfer/rebase/ERC777、代理升级后语义漂移或tokenIn==tokenOut。未知资产可由owner救援，但永远不能进入自主交易白名单。

不实现delegatecall、任意target/callData、动态路由、多跳、Permit2无限授权、借贷/闪电贷。每次给router精确amountIn授权，成交后归零，并以实际余额差验收，不只相信返回值。

## 2. 两个明确的保护模式

BOUNDED_EXECUTION是P0：链上强制原始数量预算、固定资产路由、双角色签名、版本、期限、最低输出和状态；quote由独立确定性risk流程从DEX读取并签名。它依赖risk signer对价格的诚实与正确检查，不提供独立Oracle的公允价值保证。

ORACLE_GUARDED是P1且独立session配置：在基础保护之外，读取经验证的新鲜外部喂价，并按独立oracleDeviationBps检查实际输出的公允价值。报价滑点slippageBps与oracle偏差是不同参数。研究时HSK feed stale，因此本模式BLOCKED。所有mode变更只能owner关闭旧session后启动新session，绝不运行时自动降级。

## 3. 资金分配与会话

把account余额和session拨入余额分开。startSession指定allocatedQuoteRaw与allocatedRiskRaw，必须不超过真实余额；交易只使用这一拨入子账本。直接转入的额外代币为unallocated surplus，不自动增加预算、仓位、PnL或高水位，防止赠送资金被误算收益。实际代币余额须始终覆盖已分配账本。

会话运行期间不追加拨入资本。owner deposit/top-up后要停止旧会话并开始新session；提款先关闭会话、撤销签名，再转给owner，不进行预言机估值。链上事件明确资本拨入、返还和剩余资产。不开新session不得“重置预算”。

## 4. Policy字段与单位

| 字段 | 类型/单位 | 不变量 |
|---|---|---|
| sessionId,policyVersion | uint64/uint32 | 单调增加，不可回退重用 |
| mode | enum | BOUNDED_EXECUTION / ORACLE_GUARDED |
| validAfter,validUntil | Unix秒 | 开始前不可交易，到期禁止普通交易 |
| strategySigner,riskSigner | address | 非零且不同；每笔都必需 |
| maxBuyPerTradeQuoteRaw | USDT最小单位 | >0且<=session毛买入预算 |
| maxSessionGrossBuyQuoteRaw | USDT最小单位 | 累计买入投入只增不减；卖出不补额度 |
| maxUtcDayGrossBuyQuoteRaw | USDT最小单位 | UTC日累计毛买入；不是滚动24小时；跨session不重置当天已用量 |
| maxRiskInventoryRaw | WHSK最小单位 | 买后分配库存不得超过该值 |
| maxSellPerTradeRiskRaw | WHSK最小单位 | 普通卖出上限 |
| minTradeIntervalSec | 秒 | 普通交易频率限制 |
| maxQuoteSlippageBps | bps | 0–策略允许硬上限，100bps=1% |
| maxQuoteAgeSec | 秒 | 签署参考报价的时间窗，拒绝未来时间 |
| maxIntentTtlSec | 秒 | intent不能设置超长deadline |
| exitMaxPerTradeRiskRaw | WHSK最小单位 | owner预先批准；不依赖普通买入预算 |
| exitMinIntervalSec | 秒 | 可独立于普通cooldown但不可随意绕开 |
| exitValidUntil | Unix秒 | owner明确预授权退出窗口；不得由agent延长 |
| oracleMaxAge/Deviation | P1 only | 不以“能成交”为理由放宽；修改开启新session |

目标权重、带宽、最大策略回撤和模型配置属于owner批准的链下StrategyPolicy，并将其hash写入链上SessionPolicy，使AI选择可追责；链上库存数量上限才是B0的硬性持仓约束。UI不可声称B0链上强制实时百分比权重或精确亏损百分比。

## 5. EIP-712 TradeIntent

域至少包含name=HSKPilotGuard、version、实际chainId、verifyingContract。结构中的字段固定为：

~~~
sessionId, policyVersion, strategyPolicyHash,
intentNonce, direction, amountInRaw,
referenceAmountOutRaw, amountOutMinimumRaw,
quoteObservedAt, quoteBlockNumber, quoteBlockHash,
deadline, evidenceHash
~~~

quoteBlockHash用于链下canonical校验和证据，不声称hash本身证明报价真实。合约验证时间窗与非未来区块；执行前risk重新核对canonical区块与当前状态。所有字段都被两个角色签名，不能只签reasoningHash或数量。以明确枚举direction映射固定两代币及pool，无动态recipient。

固定角色验证：恢复strategy签名必须等于策略角色地址，恢复risk签名必须等于risk地址；两者不同。不存在quorum=0或任意2-of-3。角色轮换使policyVersion递增/旧intent失效。使用成熟ECDSA实现，检验不合法签名、malleability、跨链/跨合约/跨session重放。

所有policy/模式/拨入资本变更产生新version或session，旧签名立即失效。nonce仅成功执行后消费；同一账户同一session顺序执行，链下禁止并发争用。

日预算按floor(block.timestamp/86400)切换，policy修改或新session不重置当天累计买入。收紧到低于已用量时拒绝进一步买入；卖出和按规格退出继续允许。session毛预算不因跨UTC午夜而重置。

## 6. execute流程

1. nonReentrant；读mode/status、session、policyVersion与strategyPolicyHash；确定该方向是否允许。
2. 校验两角色签名、nonce、amountIn>0、资产方向、期限、quoteObservedAt<=now、quoteAge与最大TTL。
3. 按方向检查拨入余额、普通交易上限、累计USDT毛买入及cooldown；REDUCE_ONLY只允许WHSK→USDT并使用退出规则。
4. referenceAmountOutRaw>0；amountOutMinimumRaw>0且不低于签署参考报价按slippage计算的向下取整下限。严格说明这约束签署报价的滑点，不保证参考价公允。
5. P1额外做外部oracle读取、单位转换、answer>0、updatedAt非零不在未来、age和接口语义校验；预交易先拒绝不健康数据。用同一预交易快照价格计算oracleExpectedOutRaw与oracleMinOutRaw，避免外部调用前后混合feed版本；单位转换使用Math.mulDiv及明确舍入，不假定feed decimals<=18。
6. 预更新nonce、预算、时间，记录两资产交易前实际余额；精确approve，调用经链上验证ABI的exactInputSingle，recipient=this。
7. 回收allowance；实际input余额减少量必须等于amountInRaw，实际output增加量>=minOut；P1还必须actualOutRaw>=oracleMinOutRaw，不能只检查feed健康；更新allocated账本；检查买后库存硬上限。
8. emit TradeExecuted，包含intentHash、session/version、方向、raw输入输出、evidenceHash及两角色地址。任一失败整笔回滚。

SwapRouter02是否7字段无deadline必须以G1验证ABI为准；Guard独立检查deadline，不能把旧SwapRouter八字段接口混用。QuoterV2只作链下eth_call，不加入真实swap热路径。

P1计价公式：将两feed转换为相同priceScale的正有理价格Pin、Pout，则expectedOutRaw=amountInRaw×Pin×10^outDecimals/(Pout×10^inDecimals)，oracleMinOutRaw=floor(expectedOutRaw×(10000-oracleDeviationBps)/10000)。采用足够精度的mulDiv/约分避免中间乘法溢出和重复截断；总舍入误差有明确边界测试。它和签署DEX报价的minOut同时约束输出。feed精度/参数超出实现支持范围在初始化拒绝，而不是运行时panic。

## 7. 状态与停止行为

PAUSED：不允许agent交易；owner可提款及开启新session。
ACTIVE：有效期内可按政策买卖。
REDUCE_ONLY：只允许减持WHSK，不允许新增风险，不恢复买入预算；只允许owner新session重新启用。
EXPIRED：普通交易停止；如果owner会话预授权了有效的退出窗口，只允许该窗口内的REDUCE_ONLY规则；窗口过后所有agent写入停止，owner提款仍可用。实现中expiry可由timestamp派生，UI必须一致。

enterReduceOnly(reasonCode,evidenceHash)由owner或risk角色调用，只改变状态并记录事件，不调用swap/Oracle。策略角色不能恢复ACTIVE；risk角色仅能收紧权限。重复调用幂等。当前普通买入额度耗尽不妨碍退出；退出累计不得超过已分配WHSK，且每卖一次库存下降。

stop-loss触发器由worker基于明确报价估值运行。先让enterReduceOnly交易确认，再做减仓交易。报价失败、网络故障、价格跳空、DEX操纵和滑点可能阻止/恶化成交，因此不能承诺“跌5%一定在5%止损”。

pause()是owner可独立调用的常量复杂度操作，不读外部价格，不依赖数组遍历，不发起swap。若普通交易已被区块打包，暂停无法撤回过去交易，UI说明生效block。

withdrawAllocated/withdrawAll到owner，必须先停会话并失效旧intent；不依赖oracle、model、EAS或worker；nonReentrant，不能通过recovery回调重启交易。保留原生HSK提款能力，Gas资金与USDT策略余额分开记录。若某恶意未知token自身transfer失败，仅影响该token，不阻塞其他资产提款。

## 8. 事件证据及可选EAS

基础证据用合约事件+可下载JSON+内容hash。被revert的交易没有保留执行中的event；eth_call拒绝没有真实交易hash。区分“链下拒绝”“模拟revert”“已上链失败”。

EAS在P0之后做异步锚定，不把其可用性作为swap/退出/提款前提；每个attestation指向明确event/evidenceHash。若必须采用强原子存证变体，单独说明EAS故障会导致整个swap回滚的取舍并重新验收。

## 9. 必须证明的性质

router是唯一授权spender和swap调用目标；V3输入token实际可由router.transferFrom直接进入已验证的固定pool，不能误要求所有token先进入router地址。swap输出必须到Guard；提款只到owner。模型和relayer不能提款；两个角色任一缺失不可成交；预算不会通过卖出、政策修改、重试或重启被刷新；普通交易不能绕过REDUCE_ONLY；外部价格不可用不妨碍owner拿回资金；不允许赠送资金制造交易利润；整数缩放、取整和余额差正确。测试详见docs/10。
