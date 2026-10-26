# 09 Dot 执行门禁与任务

## 运行原则

按依赖推进G0–G6。root可在接口冻结后分派合约、worker、UI和测试，不让用户逐张复制六个prompt。blocked任务不阻塞无依赖工作；所有完成声明绑定证据。阶段划分是验收，不要求停下来让用户重复批准可逆工作。

从2026-10-26起的建议排期：10/26规则/预检；10/27合约+数据契约；10/28垂直切片；10/29主网准备与有限实测；10/30浏览器/对照；10/31基础提交；11/1冻结补证。它是目标排期，不保证开发耗时，出现P0缺陷优先修复而非堆P1。

## G0 环境、授权与规则

T00恢复文件校验manifest；T01识别既有repo/branch/SHA和工具；T02核对规则及deadline；T03建立任务板、能力表、最小权限与预算需求。

输出：tasks/STATE.json、CAPABILITIES记录、规则变动、Git初始checkpoint。门禁：已能说明“能实际调用什么、什么尚不可用、哪项有用户授权”。缺密钥不是立即停工理由。

## G1 只读基础设施预检

T10 chainId/code/ABI/decimals/router/factory/pool核对；T11双向多金额quote、RPC一致性、池观测和价格新鲜度；T12选择B0及P1状态，记录来源/codehash和风险。

命令合同：pnpm doctor、pnpm chain:preflight --network mainnet --read-only。Dot先实现脚本；没有命令前不能标通过。

输出：evidence/G1/preflight.json、运行日志、validated registry。门禁：B0至少双向quote及执行ABI可验证；B1单独检查，stale不能通过。若只读预检失败，继续mock/fork开发但LIVE_FUNDS阻塞；绝不从研究快照直接认定当前网络仍可交易。

## G2 合约与业务不变量

T20实现Guard、状态、签名与拨入账本；T21构建mock和缺陷回归；T22固定区块fork路由与余额差验证；T23独立审查funds/signature/version/withdraw。

命令合同：forge build、forge test、invariant/fuzz回归、pnpm test:contracts-integration。

输出：编译版本/配置、测试报告、关键反例、ABI和typed-data fixture。门禁：docs/10中的资金与权限P0全部PASS；open P0=0。Solidity 与TypeScript计算相同typedData digest。产物未签名未部署。

## G3 最小纵向自主闭环

T30 schema/数据库及幂等；T31 monitor/candidate/strategy LLM/risk；T32 signer/coordinator/reconcile；T33 P&L和事件证据；T34自然语言差异卡基本UI。

命令合同：pnpm typecheck/test/build；本地Anvil或固定block fork跑一次session自动成交、一次HOLD、一次policy更新后拒绝、一次REDUCE_ONLY卖出、一次提款。

输出：从UI到worker到合约再回UI的一条trace，所有合成数据标注。门禁：无需owner逐笔点击；worker重启不重复；消息驱动真实policy；账本与余额一致。可以同时开始UI美化，但不得替代主链路。

## G4 真实主网与部署

T40按templates/MAINNET_ACTION_PLAN整理确定的SHA、字节码、constructor、地址、资金和Gas上限、动作及回收路线；T41核对当前会话授权；T42部署并验证源码；T43owner拨入/授权，worker自动买卖，收集真实回执；T44暂停/提款及重启对账。

授权足够即继续，缺授权则把完整可审阅行动方案交给用户，继续G5的mock浏览器及G6草稿。缺主网资格不能标G4通过。

门禁：真实链177、成功receipt、代码与部署对应、预先批准额度内、实际余额差正确、无无限授权、真实交易被同版UI读到。建议有买卖各一笔，注明这是内部证据标准，不是官方固定笔数。B0和B1状态分开。

## G5 真实浏览器和可靠性

T50 375/768/1440实际点击；T51 owner与judge权限、网络错误、钱包拒签；T52 worker离线/恢复、DB重启、nonce、reorg；T53 bounded benchmark与成本、结果披露。

输出：逐步交互记录、截图/可复查trace、console结果、测量表。门禁：核心按钮确实工作，无虚假成功/死循环；build不等于browser验收。外部钱包弹窗无法自动化时完成其它路径并记录需用户完成的一步。

## G6 提交与交付

T60 README/英文BUIDL草稿/代码许可证/AI贡献；T61演示录像和只读链接；T62证据索引与发布SHA一致性；T63按已授权范围正式提交或提供最后待提交清单。

门禁：无TODO冒充真实信息、无假链上hash、引用与产品一致、评委无需secret能看到结果；正式提交必须有平台确认/提交ID，不能把保存草稿写成已报名。即使提交成功也不能推断入围/获奖。

## 并行分工

- root：schemas、接口、锁文件、集成、部署和最终事实核对。
- contract agent：contracts及资金测试，禁止自行广播。
- worker agent：strategy/chain/worker与P&L，使用root冻结ABI。
- UI/QA agent：web、浏览器验收和演示，真实引用API。

只有三个或更少并发槽时合并UI/QA；没有子代理工具就串行，不把多代理当必须的产品能力。code review应换一个未写核心代码的角色审查，不能以代理人数当质量证据。

## 范围切割触发器

G3未通过前不做EAS/新资产/新策略。10/30仍无可复现主网闭环时停止视觉扩展与高级回测；优先修复可阻断参赛和演示的项目。距内部冻结不足一天仍主网失败，明确NO-GO或缺口，不能降低断言、增大本金或伪造回执。
