# Web ADB Manager (网页版 ADB 管理器)

[English](./README.md) | [简体中文](./README_zh.md)

一个纯网页版的 Android 调试桥 (ADB) 客户端。通过 WebUSB 协议直接在浏览器中控制您的安卓设备，无需安装任何本地驱动或软件。

## 🚀 在线演示
**[https://kekxv.github.io/web-adb/](https://kekxv.github.io/web-adb/)**

## ✨ 功能特性
- **纯网页实现**：完全基于浏览器的 WebUSB API，无服务端参与。
- **文件管理器**：支持文件上传、下载、删除及图片在线预览。
- **应用管理**：查看已安装应用、卸载、停用/启用及一键启动。
- **APK 安装**：支持拖拽或选择本地 APK 文件进行安装。
- **交互式终端**：集成 Xterm.js，支持完整 ShellV2 协议。
- **手机投屏**：高帧率、低延迟的手机画面实时预览，支持触摸点击和物理按键模拟（基于 Scrcpy 协议）。
- **响应式布局**：完美适配桌面端及移动端浏览器。

## 🛠 技术栈
- **框架**：[Next.js](https://nextjs.org/) (App Router)
- **语言**：[TypeScript](https://www.typescriptlang.org/)
- **ADB 协议**：[Tango (@yume-chan/adb)](https://github.com/yume-chan/ya-webadb)
- **终端**：[Xterm.js](https://xtermjs.org/)
- **样式**：[Tailwind CSS](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)

## 📝 使用前提
- 使用支持 **WebUSB API** 的浏览器（Chrome, Edge, Opera 等）。
- 在 Android 手机的“开发者选项”中开启 **“USB 调试”**。
- **小米/红米用户**：需额外开启 **“USB 调试（安全设置）”** 才能使用触摸控制功能。

## 💻 本地开发
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

## 📄 开源协议
MIT License. Created by [kekxv](https://github.com/kekxv).
