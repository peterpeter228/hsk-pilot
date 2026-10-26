# 12 盈亏账本与可独立核验的证据

## 1. 三种事实不能混淆

链上事实：部署、策略变更、交易状态、事件、token余额变化。策略事实：模型收到什么可见数据、选了哪一候选、risk检查哪些条件。市场判断：报价是否代表可持续价值、策略是否有收益优势。

事件和签名可以核对前两种的绑定关系，不能证明第三种。evidenceHash/EAS只证明内容承诺及记录存在，不证明AI推理正确、不证明两密钥独立、不证明获利。

## 2. P0记账单位

统一USDT计价。实际fill使用交易前后raw余额差及可验证事件。WHSK/USDT兑换产生的DEX fee和冲击已经包含在实际输入输出，不能再重复扣一遍“估算池手续费”。

拨入资金、提款与直接赠送的surplus属于资本/非策略流，不能算交易盈利。session使用明确allocated余额，新拨入资本另开session；未经分配的额外token单独列示。

## 3. 成本基础与收益

采用可复核的加权平均成本，版本锁定为ACCOUNTING_V1_WAC。买入时成本增加实际USDT减少量，数量增加实际WHSK收到量。卖出时按卖出WHSK数量从成本基础释放成本：

~~~
releasedCost = priorCost × soldRiskRaw / priorRiskRaw
realizedTradingPnl = actualQuoteReceived - releasedCost
remainingCost = priorCost - releasedCost
~~~

内部用高精度有理数/充分缩放整数，展示时才舍入，最后清仓释放所有残余舍入成本，避免长时间累积分钱差异。部分成交不是P0默认能力，实际差异无法解释时阻塞而不是编造fill。

未实现收益采用剩余整仓WHSK经固定路径的Quoter可执行USDT报价减remainingCost；报价失败或过期时返回null。不要把1 WHSK小额报价乘全仓当整仓清算价值。分别展示indicative spot weight与liquidation quote valuation。

P0禁止session内部追加/返还资本；提款会先结束session。因此在任何返还之前冻结closing余额与同口径可执行清算报价，策略盈亏与资产等式交叉核验：

~~~
E0 = allocatedOpeningQuote + liquidationQuote(allocatedOpeningRisk)
Eclose = allocatedClosingQuote + liquidationQuote(allocatedClosingRisk)
tradingPnl = Eclose - E0
~~~

E0在拨入时记录、Eclose在提款前记录；不能再加一次提款额，也不能用提款后零余额计算亏损。若退出时quote不可用，owner照常提款，Eclose/tradingPnl标unknown或partial并保留原始数量，不能因核算失败阻止提款。若session开头已分配WHSK，openingQuoteValue必须用当时同口径整仓估值，记录数据源；不可恢复时不虚构成本价，标COST_BASIS_UNKNOWN。P0推荐以全USDT拨入开始以简化证明。

## 4. 费用必须完整且不重复

真实链上运行费用：成功与失败tx、approval、policy变更、enterReduceOnly、提款及可选EAS；部署费用单列setup cost。relayer付gas不等于用户/系统无成本。

OP Stack费用以可用receipt字段和官方fee定义核实：L2 gas、L1数据费、可能的operator fee等按链实际启用情况计；不要机械只算gasUsed×gasPrice，也不要重复累计已包含的字段。无法确认完整费用时展示native HSK实际/可得部分及“不完整”，不要给虚假精确净利润。

LLM成本按实际provider/model/token价格或账单来源，记录时间和币种；无法确认价格时保留token量和unknown cost。基础设施成本为估算可单列，不混同精确交易支出。

B0缺少新鲜独立HSK/USD时，gas可显示HSK原币，并另给基于同block DEX报价的USDT估算，标记估值来源和误差；不能把此值称审计级美元成本。原币费用与估算费用不应重复扣两次。

至少显示：realizedTradingPnl、unrealizedTradingPnl、executionCosts、modelCosts、estimatedNetPnl、setupCosts和估值质量。只有费用覆盖完整且换成同一种计价单位后才给完整estimatedNetPnl；HSK、USD、USDT不能直接相加。缺费用或换算源时net=null/partial，保留已知原币明细。净收益出现负值必须保留。

## 5. 证据对象

每笔决定输出evidence.json，schema见schemas/evidence.schema.json。必须分为签名前commitment与事后execution envelope，避免循环哈希：

- codeSha、配置hash、modelProvider/id、promptVersion、token usage；
- chainId/account/session/version/mode、拨入资金及预算；
- 数据模式、snapshot block/hash/time/source和数据质量；
- 候选、模型action与简短reasonSummary、risk checks及两角色；
- 完整canonical typedData的domain和message、两角色实际签名及intentHash放入事后envelope，不能放进它自身所引用的commitment；仅有签名摘要不足以离线验签。尚不可公开的有效签名置null并注明核验受限，已消费/过期后补齐，或从真实交易calldata解码核验；
- txHash/receipt/实际token delta同样仅在事后envelope；若只是模拟链调用txHash必须null；
- 费用、估值方法、状态及limitations。

签名可能在有效期内被公开广播，所以公开完整签名只在intent已消费/过期或不再可执行后；私钥、API key、owner身份敏感信息永不导出。公开证据含必要链上数据即可。

## 6. 哈希与回放

选择一种明确的canonical序列化规范（推荐JSON Canonicalization Scheme RFC8785），金额都是字符串；commitmentHash=keccak256(UTF8(JCS(commitment)))。commitment仅包含签名前确定的代码/配置/政策/行情/候选/模型选择/静态风险检查，不包含自身hash、typedData的evidenceHash、签名、完整执行模拟或未来txHash/receipt。然后将commitmentHash放入intent.evidenceHash，双签、完整模拟、广播。模拟失败后不修改已签commitment；必要时丢弃旧候选重建。schemaVersion和hashAlgorithm明确写出，raw数据保留原字节或hash。不得用不稳定键序产生不同结果。

链上event记录的evidenceHash只锚定上述pre-trade commitment。PostTradeEnvelope引用commitmentHash，附上完整typedData、签名、simulation、receipt和余额差；整个导出文件可另算artifactHash用于下载完整性，但不能把该事后hash回填成原交易的evidenceHash。proof verifier分别校验commitment、intent/domain、两角色签名、chain/session/version/receipt事件和真实delta。证据JSON和可读摘要可以离线下载；P0无IPFS/EAS强依赖。

EAS若后加，使用单独attestation引用确切evidenceHash和TradeExecuted定位键，不重复宣称它是交易最终性证明。

## 7. 数据模式与结果标记

commitment.sourceDataMode只记录当时行情来源：MAINNET_READONLY / FORK / SIMULATION，它在签名后不可改变。事后envelope.executionDataMode单独记录执行环境：LIVE_MAINNET只用于真实资金的已广播交易及明确状态；MAINNET_READONLY是读链/quote/eth_call；FORK是fork与注入资金；SIMULATION是合成或mock/本地Anvil。独立executionKind=ONCHAIN_TX / ETH_CALL / FORK_TX / LOCAL_TX / NONE，与status=PROPOSED/REJECTED/SUBMITTED/MINED/CONFIRMED/REORGED等组合。成交后不能为了更新徽标而改写commitment。

MAINNET_READONLY的eth_call revert可以证明在指定state下合约将拒绝该调用，不能称链上发生了一笔失败交易。合成压力测试能证明程序在设定场景下的行为，不证明真实市场抗风险收益。

## 8. 复现与交付

建立evidence/index.json，按gate列数据模式、SHA、路径、时间和状态。主网成功回执与本地模拟分目录；原始研究快照固定保留，未来预检新增文件不覆盖。从独立无cookie浏览器打开提交中的explorer、repo、Demo和evidence链接，确认评委能访问。

来源：[OP Stack费用](https://docs.optimism.io/op-stack/transactions/fees)、[RFC8785](https://www.rfc-editor.org/rfc/rfc8785)、[EIP-712](https://eips.ethereum.org/EIPS/eip-712)。具体接口与费用字段需在执行环境再次核对。
