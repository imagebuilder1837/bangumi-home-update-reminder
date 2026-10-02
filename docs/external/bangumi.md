# Bangumi 首页结构与样式

> 来源：用户提供的本地浏览器保存页 `/tmp/Bangumi 番组计划.html` 及配套原站 `Bangumi 番组计划_files/bangumi.min.css`。保存页来自 `https://bgm.tv/`，宿主版本标记为 `r771`；未联网复核。
> 这是登录态、经过浏览器脚本处理的单份样本，含其他扩展注入内容，不是纯服务端 HTML。静态分析不证明当前认证、网络响应、其他域名的结构或实际视觉效果；实时页面与本文冲突时，应更新记录。

## 登录身份

- 样本中的个人入口为 `.idBadgerNeue > a.avatar[href]`，路径为 `/user/{key}`；它不同于动态行中的其他用户头像。
- `#badgeUserPanel` 中的登出入口和动态发言表单共同支持保存时为登录状态，不能据此推断当前 Cookie 仍有效。
- 未取得匿名首页样本，不将登录态结构外推为匿名结构。

## 三个内容区块

| 内容 | 容器与列表 | 身份 |
| --- | --- | --- |
| 最新动态 | `#home_tml #tmlContent #timeline`；直属 `ul > li.tml_item` | 行 ID `tml_{id}` |
| 小组话题 | `#home_grp_tpc .sideTpcList > li.row` | `.inner > a.title[href]` 的 `/group/topic/{id}` |
| 条目讨论 | `#home_subject_tpc .sideTpcList > li.row` | `.inner > a.title[href]` 的 `/subject/topic/{id}` |

### 最新动态

- 样本有 20 行，按“今天”“昨天”分成多个直属 `ul`；不能只读取第一个 `ul`。
- 动态行可能聚合多个条目，也可能没有状态详情链接；用户或条目链接都不能替代行身份。
- `.post_actions.date .titleTip` 显示相对时间，绝对时间在 `data-original-title` 中。
- 样本中较小的动态 ID 对应过更晚的时间，不能把 ID 大小作为新旧或排序契约。
- 回复入口没有数字回复数；贴贴区域的 `.num` 是反应数量，不是回复数。

### 小组话题与条目讨论

- 两类列表在样本中各有 6 个话题；这是样本数量，不是固定容量契约。
- 小组列表另有非话题行 `li.tools`，包含“更多话题”“我发表的”“我回复的”导航，不能计为话题。
- `.inner > small.grey` 显示 `(+N)`，包括 `(+0)`；位于回复数式的位置，但样本没有说明是否包含楼中楼等完整计数口径。
- 两类话题身份必须区分类别，不能仅用数字 ID 合并。
- 行内未见创建时间、最近回复时间、回复身份或明确置顶标记。首次进入首页窗口不证明主题刚刚创建；回复数上升也不能还原具体新增回复。
- `data-item-user` 是用户属性，不能作为话题身份，也不能仅凭本样本判断其代表创建者还是其他角色。

## 动态筛选与分页

- `#home_tml #timelineTabs a.focus` 表示当前筛选；样本是 `#tab_all`。
- 可见类型包括 `say`、`subject`、`progress`、`blog`，更多菜单另有 `mono`、`relation`、`group`、`wiki`、`index`、`doujin`。
- “好友”菜单指向 `type=relation`；不能据此解释成好友动态／全站动态范围开关。
- `#tmlPager .page_inner > a.p` 有 `/timeline?type=all&page=2` 链接；静态链接不证明点击时的 AJAX 行为或首页布局是否保留。
- 三个列表都是有限展示窗口；一份首页不足以证明全量内容、稳定排序或窗口外的变化。

## 样式与扩展共存

- 样本根节点有 `data-theme="light"`、`data-theme-color="pink"`；原站 CSS 用 `html[data-theme=dark]` 覆盖暗色。
- 原站 `--primary-color` 随主题色变化；默认粉色为 `#f09199`，不应把粉色当作所有主题的唯一颜色。
- 原站 `.featuredItems .appItem` 的默认入口样式使用 `linear-gradient(135deg, #f193fbd9 0, #f5576cd4 100%)`，白字带文字阴影；端点含透明度，实际颜色受底色影响。默认规则不等于 Re:Dollars 运行时入口的完整样式。
- 保存页的 Re:Dollars 注入样式另覆盖 `#xu`：边框为 `1px solid var(--primary-color) !important`，浅色底为 `var(--xH)`（该样式中是白色）；`#xu:before` 叠加纹理和 160° 三段渐变，各段将主题色与浅蓝 `#a0c4ff`、白色、浅紫 `#ffc6ff` 各混合 50%。另有暗色覆盖。这是扩展入口样式，不是通用宿主 CSS 或 toast API；不能只看原站默认渐变来判断它的边框与底色关系。
- 原站浅色页面为白底，链接文字为 `#444`；暗色表单底色为 `#303132`，链接文字为 `#eee`，常见分隔线为 `#555`。这些是视觉参考，不是通用 toast 组件契约。
- 原站有右下角 `#robot` 及 `#robot_balloon` 通知气泡规则，依赖其专有容器，不能靠添加一个 class 复用成顶部 toast。
- 样本中的 `.more-settings-clean-cache-toast*` 属于其他扩展，不能记作原生 toast API；本地原站 CSS 未发现可直接复用的通用 toast 样式。
- 页面还含聊天窗、搜索及翻译扩展的注入痕迹；自有 UI 应使用独立身份，不覆盖宿主或扩展的容器和样式。
