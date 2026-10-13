# 小船导航

[useNavigation.ts](../useNavigation.ts) 接收 islands 引用和 onArrive，输出 position、heading、isMoving，以及 navigateTo、setManualVector、stop。

## 移动约定

点击导航返回 Promise<boolean>，到达为true，被接管或取消为false。一个动画循环管理唯一移动任务。船以岛中心下方的码头为目的地；自动路径通过海上航点绕开椭圆岛体。键盘按屏幕方向自由移动，对角速度归一，海岸阻挡避免穿过岛心。

WorldMap 只在地图获得焦点时处理方向键/WASD，keyup或失焦清除输入，输入框保留正常键盘行为。App 协调手动导航停止回放。卸载时取消动画；尊重系统减少动画偏好。

## 修改后检查

导航测试涵盖逐岛与远距离航行、五十岛、海岸、键盘接管、对角等速、取消与减少动画。浏览器额外检查按住/抬起、失焦、快速点多个目的地、到达只触发一次。
