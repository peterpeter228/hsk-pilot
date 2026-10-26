# Worker模块

先读根AGENTS与docs/03、06、07、10、11、12。

常驻worker依赖持久账本与锁，不能靠浏览器维持。监控/风险是确定性程序；Strategy LLM在合法候选内决策，不持私钥、不改policy、不可输出任意calldata。

预算按方向和raw单位检查；卖出不恢复gross-buy；退出不受普通买入预算锁死。模型异常HOLD，但确定性退出不依赖模型。risk签名之前查当前policy，签名之后完整eth_call，广播前再核时效。

SUBMITTED/UNKNOWN必须reconcile而非重发。账户只有一个广播者；处理replacement与reorg。所有input、version、mode、费用、hash保留证据。日志禁secret，公开签名只在已消费/过期后。

修改金额、幂等、P&L、政策失效逻辑必须跑对应回归。市场报价不等于公平价格；不得把数次正收益视作长期优势。
