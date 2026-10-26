# 合约模块

先读根AGENTS与docs/04、05、10、12。本文件是范围更具体的工程规则，不授予部署或资产操作权限。

只实现已核查的单owner固定两资产固定router。固定两角色签名都必需。chainId/domain/version/nonce不可省略；实际余额差验收；精确approve后清零；金额用raw整数。候选地址必须通过当前预检，禁止把附注数字带入地址或把SHA256当extcodehash。

pause/withdraw不能读Oracle/Quoter/EAS。REDUCE_ONLY先独立持久化，不能依赖revert留下状态。退出规则不受普通买入预算锁死。无动态trackedTokens数组、无任意call、无共享募资金库。

每次资金/签名/状态逻辑变更跑对应回归与必要invariant，再做整体forge test；编译、mock、fork、主网证据分开。修改EIP712必须同步shared类型并比对TS/Solidity digest。保持编译器配置可复现。

部署脚本默认dry-run。独立审查P0未清零不得广播；已准备好具体主网行动后按当轮授权执行。输出风险及实际测试，不以大量简单测试当安全结论。
