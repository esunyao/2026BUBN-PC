# 应用组装与状态

[App.vue](../App.vue) 组装地图、旅伴筛选、回忆、导入和时间条；[useTrip.ts](../useTrip.ts) 是唯一会话数据入口；[demoTrip.ts](../demoTrip.ts) 创建十地点、三人示例。

## 输入输出与协调

useTrip 管理 islands、photos、participants、activeParticipantIds、selectedIslandId，并提供 addImport/placePhoto。照片用 islandId 关联地点，不维护第二份岛内照片数组。过滤后得到 visiblePhotos 和 selectedPhotos。

App 把 islands 与抵达回调传给 useNavigation，把 navigateTo 传给 useReplay。点击地图和键盘操作先停止回放；回放只决定下一段记忆，导航独占移动过程。导入面板通过事件交付结果，应用更新会话。关闭页面时释放用户图片 Blob URL。

## 修改后检查

运行 useTrip/replay 相关测试及类型检查。修改协调流程时，实际检查播放中点击岛、按键接管、筛选人物和导入图片；旧航行完成不能重新打开已取消的回忆。
