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
| ADR-011 | HO-hsk-mainnet-1仅做固定源paused部署准备；WP4 WAITING_GAS / NOT_BROADCAST | PUBLIC/TEST专项授权已落地，但无gas且owner/额度/期限/费用/确切packet发布门禁仍未齐 | 全部释放门禁和适用授权独立确认后；不得因到账自动广播 |

追加ADR时写背景、备选、选择、代价、验证和受影响文件；不要让子代理私自改跨模块契约。

## Implemented choices and limits
- React/Vite plus Fastify instead of Next: one local server and reusable worker libraries; actual build/HTTP passed.
- B1 remains disabled. Updated chain evidence shows30-minute pool observations now succeed, but stale independent HSK feed and access questions remain. No quiet downgrade.
- Runtime trading coordinator restricts adapters to SIMULATION/FORK. Environment keys do not enable production trading; the narrow HO paused-creation authority below neither enables this coordinator nor grants session/trade authority.
- UI sandbox is process-local and clearly synthetic; real PostgreSQL coordinator tests do not imply its live integration.
- Native Foundry resolver used because pinned npm wrapper did not reliably propagate child exit/signal. Failed harness/build/HTTP attempts preserved; tests were corrected and rerun, not relabeled.

## ADR-011 — HO-hsk-mainnet-1 preparation boundary (2026-10-27)

**Background:** The external [HO receipt](/workspace/web3-bounty/v3-reconcile/evidence/hsk-mainnet-20261027/ACCEPTED.md) accepts this handoff ID, fixed source `1f1a48d56df96fc6f838d0696f1b5e3500bcf004` and chain177. Later steering supersedes the original handoff's PRIVATE/missing-EOA/TEST-ban wording: repository is already PUBLIC under consumed `AUTH-20261027-HSK-PUBLIC`; `AUTH-20261027-HSK-DEPLOYER-TEST` designates TEST `0x04b0A7AFD4Ab71C5d49c4bd578C2D9B8eA7DF36E`. PAYOUT remains banned as deployer. This receipt is not acceptance of, or a broad ownership transfer under, the unchanged `coordination/handoff.json` proposal.

**Alternatives:** Treat outdated generic bans as current (incorrectly blocks authorized preparation); treat deployer designation or a funded balance as complete signing approval (incorrectly expands authority); or retain the narrow conditional paused-only scope while finishing all nonfinancial preparation. Choose the last option.

**Decision:** WP1 merged-plan/provenance, WP2 historical read-only PASS plus missing public reads, WP3 UNSIGNED action plan and WP5 Submit fields/artifact drafts are preparation outcomes. WP4 is **WAITING_GAS / NOT_BROADCAST** from user-observed/reused zero balance; no key access, signing, gas sourcing, transfers, watcher or automatic broadcast if funded. `DREAMSHIELD_G1_PRIVATE_KEY` is recorded by environment-variable name only. The only conditional later write contemplated by `AUTH-20261027-HSK-MAINNET` is one zero-value paused Guard creation, with read-only verification and authorized source verification after all release gates. No funding/allowances/session/trades/ownership transfer/worker activation, submission, X, contact or visibility mutation is included.

**Remaining gates / cost:** TEST as initialOwner stays **proposed**, not final owner authorization. `maxGasHskRaw` and `authorizationExpiresAt` remain null. Complete chain fees, sufficient gas and exact-packet independent release review remain distinct unresolved conditions; root has now supplied pristine fixed-source fixed-block-fork smoke, separately scoped below. Reviewer wording **“fund ≥~2.5 HSK to deployer on 177”** is an external-prerequisite recommendation only, neither an authorized transfer nor a sufficient fee/spend bound. Product model/access/integration, hosted judge access/license and actual form/legal/KYC/payout conditions stay separate; G3–G6 are not PASS.

**Evidence / verification:** Root's [provenance](../evidence/HO-hsk-mainnet-1/provenance.json) and [creation reads](../evidence/HO-hsk-mainnet-1/creation-readonly.json) record fixed-source artifact/initcode reconstruction and constructor `eth_call`, not a deployed contract; immutable-masked runtime structure is not independent proof of all mainnet immutable values. The new [pristine paused fork smoke](../evidence/HO-hsk-mainnet-1/paused-fork-smoke.json) passes for exact proposed-owner initcode, source177/block29372120 and local execution31337 from a synthetic unlocked sender, not actual TEST readiness. Root's [project doctor](../evidence/HO-hsk-mainnet-1/project-doctor.json) is `pnpm run doctor`, not pnpm11's built-in `pnpm doctor`. State/docs worker ran no commands/tests. Root's [RECEIPT.json](../evidence/HO-hsk-mainnet-1/RECEIPT.json) and [verification.json](../evidence/HO-hsk-mainnet-1/verification.json) exist; final checks/checkpoint and external [IMPLEMENTATION_RECEIPT.json](/workspace/web3-bounty/v3-reconcile/evidence/hsk-mainnet-20261027/IMPLEMENTATION_RECEIPT.json) remain root-owned. Pending outcomes are not PASS.

**Version identities / affected files:** Fixed deployment source and baseline HEAD are `1f1a48d56df96fc6f838d0696f1b5e3500bcf004`; later implementation checkpoint/head is recorded by root without self-reference. Browser/video remain source `ccdbed53c4e57d8817e0d4e82fd22023c996b713` / evidence checkpoint `cc2b93a84fd0e258c0e781eb3f5ced266a47c563`, SIMULATION. Affected: task state/history, `templates/MAINNET_ACTION_PLAN.md`, submission/evidence indexes, `docs/11_DEPLOYMENT_AND_OPERATIONS.md`, `docs/OWNER_HANDOFF.md` and HO evidence packet. Guard/ABI/compiler/config/locks/runtime approval settings and coordination ownership/proposal are unchanged.
