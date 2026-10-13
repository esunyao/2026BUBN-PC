# 公共代码

[types.ts](../types.ts) 定义 Point、Gps、Participant、Island、Photo、Theme 和导入事件。Photo.photographerId 表示拍摄者，islandId=null 表示待安放。

## 已复用内容

- ui/PixelIsland.vue、PixelBoat.vue：地图像素图形，十种地标共用岛体和主题颜色。
- ui/BaseButton.vue、ParticipantAvatar.vue：应用和时间条使用的共用控件。
- lib/layout.ts：示例、导入与新增地点共用的固定四列交错布局。
- lib/geo.ts、photoFormat.ts：GPS距离/最近地点与照片时间/人物名称格式。
- styles/theme.css：页面布局、控件、日夜主题变量。

公共组件通过 props 输入，composable 通过引用与回调协作；不强制 class。仅提取真实重复代码，领域状态留在 app 或所属模块，shared 不导入业务模块。

## 修改后检查

类型改动需检查全部使用方；主题改动需查看1440、1280和390宽的白天、夜晚及面板。修改共享距离或布局必须重跑归组与导航测试。
