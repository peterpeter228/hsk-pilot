# 决策记录

| ID | 决定 | 理由 | 何时重评 |
|---|---|---|---|
| ADR-001 | Track1继续 | 官方允许全球个人及线上Demo，主网硬门槛可规划 | 规则更新或关键基础设施不可用 |
| ADR-002 | B0为主线；B1独立 | 当前APRO stale且TWAP OLD，不能伪造公允价保护 | 新鲜独立数据源实际验证后 |
| ADR-003 | 单池WHSK/USDT再平衡 | 研究只确认fee3000池；多策略会拖慢闭环 | P0通过及新增真实pool证据 |
| ADR-004 | 固定strategy+risk两角色 | 任意2-of3可绕过risk，0 quorum存在漏洞 | 明确新安全模型且完整回归 |
| ADR-005 | owner单账户、固定路由 | 减少资金权限与集成范围 | 赛后独立评估多用户需求 |
| ADR-006 | event+pretrade commitment | 去掉EAS热路径依赖，避免事后receipt循环hash | P0通过再加异步EAS |
| ADR-007 | UTC日与session gross-buy | 防往返刷新额度，单位直接USDT | 真实用户需求改变且owner显式批准 |
| ADR-008 | keeper触发REDUCE_ONLY独立tx | revert不能保留暂停；减仓可能单独失败 | 不改变该不变量 |
| ADR-009 | 以真实负结果也可交付 | 无足够样本证明持续盈利 | 有可信长样本与基线再评价 |
| ADR-010 | 提前按正文截止交付 | 官网时间组件冲突 | 主办方可信澄清 |

追加ADR时写背景、备选、选择、代价、验证和受影响文件；不要让子代理私自改跨模块契约。

## Implemented choices and limits
- React/Vite plus Fastify instead of Next: one local server and reusable worker libraries; actual build/HTTP passed.
- B1 remains disabled. Updated chain evidence shows30-minute pool observations now succeed, but stale independent HSK feed and access questions remain. No quiet downgrade.
- Runtime coordinator restricts adapters to SIMULATION/FORK. Production signing/financial execution is not enabled by environment keys or this handoff.
- UI sandbox is process-local and clearly synthetic; real PostgreSQL coordinator tests do not imply its live integration.
- Native Foundry resolver used because pinned npm wrapper did not reliably propagate child exit/signal. Failed harness/build/HTTP attempts preserved; tests were corrected and rerun, not relabeled.
