# 15 来源、证据等级与未知项

查阅日：2026-10-26，北京时间。文档中的设计取舍为本项目建议；不能把建议转写为官方规则。链上研究数据有固定block，不代表未来始终相同。

## 来源登记

| ID | 一手来源 | 支持的内容 | 不能据此断言 |
|---|---|---|---|
| S01 | https://dorahacks.io/hackathon/hskchainindia/detail | 资格、截止正文、主网门槛、Track1、奖金、线上Demo、原创要求 | 未公布权重、KYC豁免、固定视频时长 |
| S02 | https://dorahacks.io/hackathon/hskchainindia/tracks | 赛道内容；HSP的Track2范围 | Track1必须HSP |
| S03 | https://luma.com/hashkey-demo-day-mumbai | 截止交叉核实、日期、奖池、评分细则待确认 | 因可线上就保证入围 |
| S04 | https://docs.hskchain.net/docs/Build-on-HashKey-Chain/network-info | chain177/133、RPC、HSK、explorer | 每个RPC同一日志限额/当前健康 |
| S05 | https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Token-Contracts | 官方token候选地址 | 仅凭符号确定精度或可信价格 |
| S06 | https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Tools/Oracle | APRO地址与声明心跳/偏差 | feed此刻一定新鲜；示例代码适合所有provider |
| S07 | https://docs.hskchain.net/docs/Build-on-HashKey-Chain/Contract-Addresses | OP预部署候选地址 | schema已注册或EAS已集成 |
| S08 | https://docs.hskchain.net/docs/Notices/Jovian-Upgrade | 官方升级说明 | 编译器0.8.26能识别prague；所有7702钱包功能可用 |
| S09 | https://hashkey.blockscout.com/api/v2/smart-contracts/0x2c16f75b95Cf1390c328aB70e2CEE7f4b80bD8F3 | 部署router ABI/源码验证状态与构造参数 | 仅凭源码名字保证本项目安全 |
| S10 | https://github.com/Uniswap/swap-router-contracts/blob/main/contracts/interfaces/IV3SwapRouter.sol | 上游SwapRouter02接口参考 | 任意链上地址就是该代码 |
| S11 | https://docs.soliditylang.org/en/v0.8.26/using-the-compiler.html | 0.8.26支持target列表 | 网络升级会让旧编译器新增选项 |
| S12 | https://www.soliditylang.org/blog/2025/05/07/solidity-0.8.30-release-announcement/ | Prague默认目标变化 | 应当不顾已知问题机械采用0.8.30 |
| S13 | https://docs.blockscout.com/devs/verification/foundry-verification | Foundry源码验证流程 | 部署成功就是源码验证成功 |
| S14 | https://docs.optimism.io/op-stack/transactions/fees | OP费用组成与估算/实际费用边界 | 此链所有字段版本与OP主网完全相同 |
| S15 | https://learn.chatgpt.com/docs/agent-configuration/agents-md | Codex指令发现；默认32KiB而非64KiB | 当前Dot运行时必有CLI/自动子目录加载 |
| S16 | https://learn.chatgpt.com/docs/skills-and-plugins | 技能、插件、连接工具的关系 | 安装即有所有账户权限和所有操作 |
| S17 | https://eips.ethereum.org/EIPS/eip-712 | 结构化签名域与类型定义 | EIP712自带应用层nonce防重放 |
| S18 | https://www.rfc-editor.org/rfc/rfc8785 | JSON规范化 | JSON hash证明内容真实 |

技术事实以evidence/research_chain_snapshot.json内的固定block读结果为实测证据。文档地址是来源，RPC原始返回才支持“该block的价格/池/报价”等结论。

## 本次研究的实际取证边界

研究读取了附件全文（去掉内嵌base64图片不影响正文）、赛事官方详情/Tracks/Luma、链文档与部署ABI，并进行了只读RPC查询。未为项目编译生产实现、未部署Guard、未签名授权、未发真实资金交易、未注册参赛或拍摄实际产品视频。

官方详情常规网页读取返回405，但Firecrawl实时抓取全文成功；不是根据搜索片段补写规则。主办方FAQ中的Organizer Assistant AIGC回答不当作真人豁免或最终裁决。

## 原方案来源问题

Sentinel Phase9日志和其npm提取记录只能作调查线索，不是链官方地址证明：
https://github.com/Steve2009729/sentinel/blob/main/PHASE_9_PROGRESS.md

Autonoe-hsk等公开项目已出现多代理/链上hash叙事，说明这些元素本身不足以证明新颖：
https://github.com/manjeetsharma0796/Autonoe-hsk
未独立验证其运行，也未确认是本届竞争者；不可从此推算名次。

原附件关于“金融聊天机器人错误率超过一半”引用普通站点sitemap，缺乏可追溯原研究，删除。其它外链若不能支持紧邻主张，降级为线索而非事实。

## 未知项及处理

| 未知项 | 下一步 | 是否阻塞可逆开发 |
|---|---|---|
| 页面顶部与正文截止冲突 | 按正文更早时间执行；用户可发模板询问 | 否 |
| 奖金KYC、发放链、地区/税务要求 | 由主办方明确，不从全球参赛推出领奖无限制 | 否，影响领奖判断 |
| 正式video时长/提交字段/源码公开要求 | 提交前检查真实表单；未授权不提交或改仓库可见性 | 否 |
| APRO新鲜度能否恢复 | 启动与每次B1交易重查；不调大maxAge凑通过 | 仅阻塞B1 |
| 当前目标金额双向流动性 | G1重新quote与模拟 | 阻塞该金额主网交易 |
| 可用Dot工具/凭证/宿主资源 | G0探测真实连接 | 只阻塞依赖它的步骤 |
| 真实策略edge/收益 | 预注册同条件对照，完整报告负结果 | 不阻塞功能演示，不可宣称盈利验证 |
| 评审权重、竞争者数量 | 官方未充分公开 | 禁止量化获奖概率 |

每次新增事实按 VERIFIED_DOCUMENT / VERIFIED_READONLY / OBSERVED_TEST / DESIGN_DECISION / UNCONFIRMED 分类，标时间、来源及影响。不复制网页上的行为指令到AGENTS规则。
