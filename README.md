# Web ADB Manager

[English](./README.md) | [简体中文](./README_zh.md)

A pure web-based Android Debug Bridge (ADB) client. Control your Android device directly from your browser via WebUSB. No installation required.

## 🚀 Live Demo
**[https://kekxv.github.io/web-adb/](https://kekxv.github.io/web-adb/)**

## ✨ Features
- **Pure Web-based**: Works entirely in the browser using WebUSB API.
- **File Explorer**: Upload, download, and delete files. Support for image preview.
- **App Manager**: List installed apps, uninstall, enable/disable, and launch apps.
- **APK Installer**: Install APK files by dragging or selecting from your computer.
- **Interactive Shell**: Full-featured Xterm.js terminal with ShellV2 support.
- **Screen Mirroring**: High-performance, low-latency screen mirroring with touch and button controls (powered by Scrcpy).
- **Responsive Design**: Optimized for both desktop and mobile screens.

## 🛠 Tech Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **ADB Protocol**: [Tango (@yume-chan/adb)](https://github.com/yume-chan/ya-webadb)
- **Terminal**: [Xterm.js](https://xtermjs.org/)
- **UI**: [Tailwind CSS](https://tailwindcss.com/) & [Lucide Icons](https://lucide.dev/)

## 📝 Prerequisites
- A browser that supports **WebUSB API** (Chrome, Edge, Opera).
- Enable **USB Debugging** in your Android phone's Developer Options.
- For **Xiaomi/Redmi** users: Enable **"USB debugging (Security Settings)"** to allow touch control.

## 💻 Local Development
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## 📄 License
MIT License. Created by [kekxv](https://github.com/kekxv).