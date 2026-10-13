# 前端总览

当前入口 main.ts → app/App.vue → useMemories.ts。Hero 通过规范化 Event/Scene/Moment/Contribution 实现 Home、章节、相纸堆叠、交汇、对照、时间轴、星图与环境。

[应用状态](../src/app/doc/README.md)、[功能组件](../src/features/doc/README.md)、[公共类型](../src/shared/doc/README.md)、[完整实现与边界](../../IMPLEMENTATION_NOTES.md)。历史地图/navigation/useTrip 保留供后续导航层参考，当前运行入口不挂载。features 通过 props/events 协作，不引入第二份全局状态。
