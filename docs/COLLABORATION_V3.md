# dot / Grok 协作协议 V3：本仓库采用记录

来源：用户于 2026-10-26 提供的《ChatGPT_Dot_与Grok猎人及Dev协作补丁_V3(1).md》，Library ID `libfile_a3e270bed0048191bdc2a1e79a25eae3`。本文件为工程落地摘要，不伪称原附件逐字副本。

## 状态与权限
- dot 仍为 build_owner。GROK_HUNTER（机会/规则观察）与 GROK_DEV（独立工程接管）是两个不同角色，不设第三管理 Bot。
- `coordination/handoff.json` 是 **PREPARED / UNSENT** 工程交接提案，不是组合机会账本，不是接收回执。watch_owner/state_writer 未获真实接受证据时保持 null；Hunter 仅为 Web3 组合账本的建议唯一写者。dot 仅维护本仓库工程事实与事件提案。
- 不覆盖 Grok 缓存、不争写组合 state。接受者必须独立读固定 SHA、规则、测试和剩余缺口，给出可核验 ACCEPTED 回执；此前 dot 仍负责。接受表示责任转移，不代表验收合格或正式提交。
- 当前没有已验证的 Grok 通信端点或接收确认：保持 UNSENT。Notion 连接与私有项目页已实际创建；本分支同版本读回未完成，保持 SYNC_PENDING，准确页面链接见 PROJECT_PROFILE。此处 JSON 和校验器不是已部署同步系统。
- 本项目规则监控未实际启用，标 UNSCHEDULED。其他原有扫描任务保持原样；须真实确认 Hunter Routine 已接责后，才能另行按授权停旧任务。本次没有新增、暂停或删除任何 Routine。
- 文档不能授权新凭证、主网、钱包签名、付款、发布、合并、报名或提交。主网专项检查须在任何签名前完成，G6 不能补票；本项目需要主网，不能标 NOT_APPLICABLE。

## 输入与交接契约
每次工程续跑先读 AGENTS、远端完整 SHA、未合并 PR、当前规则包和 handoff。跨平台不共享文件系统；只接受可访问文件或 GitHub 固定 SHA，不以对方 `/workspace` 路径证明已阅读。

规则包必须覆盖 opportunity_id / round_id、官方组织者与本期 URL、奖励及付款条件、申请/领奖资格、构建来源/Studio/平台/网络、AI/旧代码/IP、各期限和冲突、真实评分标准、必交材料、关键未知与本轮授权。缺字段保留 null/unknown；只复核关键和变化项，不重复有效的整轮调研。未收 Hunter 规则包不伪称已收到；当前由仓库已有官方证据形成工程引用清单。

固定任务记录包含 repo、完整 SHA、分支、允许路径、禁止变更、测试命令、费用和时间约束、证据与退出条件。交接含协议、from/to、项目/机会/轮次、gate、DONE/BLOCKED/NEXT/VERIFY、未提交变更、真实测试/部署/规则/未知、用户动作、claims_not_made、next_step 与 expires_at。记录过期只要求重新验证，绝不自动执行外部动作。

## 分数不等于权限或收入
Hunter 七维权重使用 25/20/20/15/15/3/2；本附件未给全维定义及 level 映射，未知 levels 保持 null，total=null。不建立竞争的四维总分，不将旧87分当胜率。

strict_fast_cash 必须满足首款至少150美元等值、checked_at起10天内实际到账、官方提交数<15及全部其余条件；注册数、奖池和截止不替代这些证据。未取得全部条件定义/证据则 qualified=null，不自动PASS。该标签不降低现有正式自动开发的个人金额>=400、75分、75%覆盖和所有硬门槛，也不覆盖原 CashFirst 台账。当前开发源于用户点名授权，不伪称经机会评分自动入选。

MVP<=16小时不是从零总成本。记录已有代码、本次增量、审查/材料和等待；未知工时保留null。SaaS另用可证伪假设→低成本实验→价值行为→GO/ITERATE/PIVOT/KILL，不套Web3获奖评分。奖金、注册、自转和演示不等于商业收入。

## 本地校验与发送规则
运行 `node scripts/validate-collaboration.mjs coordination/handoff.json` 和 `node --test tests/collaboration-protocol.test.mjs`。校验器只读本地文件，不发送、不调度、不改 owner。

outbox 使用固定事件 ID / idempotency_key，source_commit 为工程检查点而非载荷内容哈希。当前校验器拒绝单记录内重复键，但不是跨系统事务去重服务；发送者仍须检查接收方已有事件及载荷冲突。发送前核实目标、权限及记录有效期。确定失败保留事件并记录错误；结果未知先查询接收方，不换 ID 盲目重发。真实接收回执才能改变 owner。Notion 仅为同一事实投影；需页面 ID、写入结果与同版本回读才可标同步，人写新要求作为 change_request 待评估，不自动覆盖工程事实。

source_commit、build_commit、deploy_commit、证据提交与 submission_frozen_commit 分开。构建时未提交的源码通过基线+精确文件hash描述，不倒填后来文档SHA。提案固定引用之前已验证检查点，文档自身提交由 Git 历史标识，不循环写入自身SHA。

## 本次不处理
不改 ArcProof、扫描器或 SaaS 仓库；附件 ArcProof SHA 为历史线索，不是新基线。SUBMISSION_UNVERIFIED 应按实际平台回读处理，不能由文档触发重提。本仓库改造未联系 Grok、停止监控或改变权限；父任务已实际创建私有 Notion 项目页，本分支同版本同步仍待读回。

## 基础首轮提示词的补充落地
已完整读取2026-10-26 v1.0《chat.md》，来源Library libfile_2d10cbee8b5c81918535e0217211716f。新改动走真实 Issue→独立工作分支→draft PR→CI→review，未经授权不合并 main。基础语义档案合并到 PROJECT_PROFILE/STATUS/HANDOFF 与既有实质文档，避免空模板。内部 PREPARED 映射 Notion handoff_status=NONE，不假冒 OFFERED。Notion 为投影，完成同项目/版本/负责人双侧读回前同步为 PENDING。
