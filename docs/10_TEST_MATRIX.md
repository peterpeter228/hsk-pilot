# 10 测试与独立验收矩阵

本文件是待执行的测试计划，所有条目初始NOT_RUN。必须记录实际SHA、环境、命令、时间、exit code及断言；编译成功、测试数量或截图漂亮不能代替关键性质。

## 合约P0

| ID | 场景 | 必须观察的结果 |
|---|---|---|
| C01 | 正常双角色买入/卖出 | raw余额差、事件、nonce、预算准确 |
| C02 | 少任一角色/两个相同角色/错误角色 | 拒绝且状态不变 |
| C03 | 跨链、跨Guard、跨session、跨version重放 | 全部拒绝 |
| C04 | 同nonce重复、deadline过期、未来报价、TTL过长 | 拒绝 |
| C05 | 金额0、负输入解析、极大uint、未知资产/路由 | schema/合约正确拒绝 |
| C06 | 单笔超限、累计毛买入超限 | 拒绝；买卖往返不恢复额度 |
| C07 | 反复更新policy或轮换signer | 不重置预算，旧签名失效 |
| C08 | 低于minOut/错误token方向/虚假router返回 | 按实际余额差失败 |
| C09 | approve后router失败 | 整笔回滚，不留可用额外授权 |
| C10 | 正常成功后allowance | 归零且不能额外取款 |
| C11 | reentrancy攻击token/router | 不能重入交易、提款或更改会话 |
| C12 | PAUSED仍尝试交易 | 拒绝；owner提款成功 |
| C13 | REDUCE_ONLY尝试买入 | 拒绝；合法卖出仍可执行 |
| C14 | 普通预算耗尽/cooldown尚未结束 | 预授权退出路径仍按独立规则执行 |
| C15 | 会话到期/退出窗口到期 | 普通/退出权限按规格失效；owner提款可用 |
| C16 | 先enterReduceOnly后卖出回滚 | 退出状态仍持久，不能误恢复ACTIVE |
| C17 | Oracle/LLM/EAS/worker全部不可用 | owner pause/withdraw无需它们，仍可执行 |
| C18 | token移除/重复添加 | P0无动态列表；不能重复估值 |
| C19 | 直接赠送token | surplus不增加session预算或PnL；提款可回收 |
| C20 | 账户真实余额低于拨入账本 | fail closed，不能继续交易或伪造资产 |
| C21 | owner变更/撤销会话 | 关闭旧权限；新owner二步接受后可回收 |
| C22 | 非owner提款/改policy/恢复ACTIVE | 拒绝 |
| C23 | 卖出收益很多或亏损 | gross-buy预算仍只有原批准值 |
| C24 | USDT6/WHSK18、小数与舍入 | 与高精度参考计算一致 |
| C25 | 输出金额或输入差非标准ERC20 | 拒绝；不悄悄支持转账税/rebase |
| C26 | B0/B1切换 | 必须新session明确授权，旧签名不能继续 |
| C27 | renounceOwnership/转移期间重开会话 | 放弃owner失败；pending及accept时旧权限始终失效 |
| C28 | 本地取消仍有效的旧双签 | 能识别未链上撤销，等待过期或真正invalidate后再签新意图 |
| C29 | V3输入实际流入pool | 固定pool接收输入，Guard接收输出，router为唯一spender |
| C30 | 模型不可用且普通冷却未结束 | 已持久REDUCE_ONLY内预授权退出仍可按exit规则双签执行 |

P1 Oracle开启时额外测试：answer<=0、updatedAt=0、未来时间、边界时效、feed decimals>18、token decimals异常、feed revert、相同资产/不同精度、双边价格过期、deviation与slippage分别检查。未来时间不能被当成“很新”；maxAge不能因测试失败放宽。

## invariant/fuzz

随机买卖、policy变更、签名轮换、暂停、退出、提款序列中：实际余额始终覆盖拨入账本；毛买入消耗单调；无人可越owner权限；REDUCE_ONLY期间风险raw库存不增加；一次intent最多成交一次；成功事件与真实余额差一致。选择能捕获真实经济错误的属性，不以简单getter测试充数。

## fork与链上

F01固定区块fork确认factory.getPool、token0/1、fee、router.factory/WETH9；F02通过真实router买卖各一笔，使用本地注入资金且标FORK；F03真实Quoter与minOut、decimals一致；F04池缺失/流动性不足/OLD的错误明确；F05同固定block第二RPC验证关键值。

fork可以注入资金、控制时间和mock极端价格，但不能冒充真实主网收益。LIVE_MAINNET阶段只在授权后，用实际少量资金重复核心成功链路；负面攻击默认用eth_call/fork，不为截图无谓烧gas。

## worker、账本与LLM

W01模型输出越界不签；W02超时/拒绝HOLD；W03数据注入不改权限；W04只有合法候选且HOLD不广播；W05重启恢复pending不双发；W06多worker抢锁只一笔；W07policy更新撤销旧队列；W08RPC disagreement禁止签；W09reorg回滚账本；W10replacement只有一笔最终费用/成交；W11receipt失败计gas但无fill；W12owner收紧额度立即影响下一决定。

P01入金不是利润；P02提款不是亏损；P03买入成本用实际USDT流出、不能重复扣DEX fee；P04卖出按加权平均成本实现利润；P05外部relayer gas仍记录；P06报价过期返回null；P07探针价不线性推全仓清算价值；P08部署费用与运行费用分开；P09剩余token清仓估值含路径影响；P10surplus不计策略收益；P11稳定币脱锚时USDT与USD不混同。

## 浏览器

按docs/08执行实际点击：judge只读、连接/错误链、owner政策预览/拒签/确认、自动运行、实时receipt、HOLD解释、policy变更、模拟拒绝、REDUCE_ONLY、退出提款、证据下载。375/768/1440；关闭标签页worker继续运行；断网恢复不显示假成功。

## 报告格式

~~~
testId, gate, codeSha, environment, dataMode,
commandOrInteraction, startedAt, finishedAt,
expected, observed, status,
evidencePath, txHashOrNull, knownLimitations
~~~

PASS仅用于实际执行且断言成立；FAIL是断言不成立；BLOCKED是前置条件缺失；SKIPPED必须说明范围决定。没有实际执行记录就NOT_RUN，不以“计划已写”计测试通过。
