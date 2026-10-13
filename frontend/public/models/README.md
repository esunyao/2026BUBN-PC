# 本地图片特征模型 · 2026-10-13

MobileNetV3 Small 0.75，官方 MediaPipe Image Embedder float32/1，224×224 输入。模型约 3.9 MiB，仅整理照片时加载；MediaPipe 1.1.0 的 SIMD/非 SIMD WASM 运行时一并本地托管（约 25 MiB，两者按浏览器能力择一加载）。没有运行时 CDN 或远程推理。

- 模型来源：https://storage.googleapis.com/mediapipe-models/image_embedder/mobilenet_v3_small/float32/1/mobilenet_v3_small.tflite
- 模型说明：https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder
- Web 接口：https://developers.google.com/edge/mediapipe/solutions/vision/image_embedder/web_js
- 模型 SHA256：bbbb4c51a55a53905af1daec995ca1aae355046f8839bb8c9f5ce9271394bc40
- 运行时来自锁定的 npm @mediapipe/tasks-vision 1.1.0，Apache-2.0，许可证见 LICENSE.mediapipe，版权属于 Google/MediaPipe contributors。

只输出画面特征向量，辅助相似度比较，不生成事件事实、场景名称、人脸身份或感受。它不是通用多模态大模型。
