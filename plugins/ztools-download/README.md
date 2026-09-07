# 🚀 Aria2 多线程下载器 (ztools-download)

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](plugin.json)
[![Platform](https://img.shields.io/badge/platform-Windows-brightgreen.svg)](plugin.json)
[![Engine](https://img.shields.io/badge/engine-Aria2c%20v1.37.0-orange.svg)](bin/aria2c.exe)

基于 **Aria2** 引擎打造的高性能、极轻量、多线程加速下载工具插件。内置暗黑玻璃拟态 (Dark Glassmorphism) 现代 UI 设计，支持最高 16 线程分片加速、BT 磁力链解析、断点续传、系统代理继承与全自动持久化存储。

---

## 🌟 核心特性 (Key Features)

### 1. ⚡ 16 线程并发分片加速
* 采用开源高性能 Aria2c 守护进程作为底层引擎，支持 HTTP / HTTPS / FTP / BT 等多协议。
* 动态分片并发下载，最高支持 **16 线程**同时发包请求，轻松突破服务器单连接限速，跑满宽带上限。

### 2. 🧲 BT 种子与 Magnet 磁力链原生支持
* 支持 `magnet:?xt=...` 磁力链接解析与 BT 种子文件下载。
* 内置 **DHT 网络**、**PEX 节点交换**、**LPD 本地发现**，并自动注入全球高可用 **Public BT Trackers** 服务器列表，大幅提升磁力链节点寻址与下载速度。

### 3. 💾 任务记录全自动持久化 (Resumable & Persistent)
* **引擎层会话保存**：配置 `--force-save=true` 与 `--save-session`，即使下载完成或取消，任务元数据依然永久保留在 `.aria2.session` 会话文件中。
* **本地 DB 深度持久化**：结合 ztools 本地数据库 (`services.dbSet` / `services.dbGet`) 实施双向同步，即使重启电脑、重启插件或强制关闭进程，所有历史下载记录与进度均 100% 永久留存。

### 4. 📋 智能剪贴板识别与文件名清洗
* 自动感知剪贴板中的 HTTP/HTTPS/FTP/磁力链接，唤出即用。
* 自动剥离 URL 尾部的冗余查询参数（如 `?utm_source=...`），自动进行 URL 编码解码（如 `%20` 转标准空格），保证界面显示的名称与磁盘落地的文件名完全一致。

---

## 🚀 快捷指令 (Plugin Commands)

在 ztools / utools 搜索框输入以下关键字即可快速唤起插件：

* `download`
* `aria2`
* `下载`
* `下载器`
* `多线程下载`
* `xz`

---

## 📖 使用指南 (Usage Guide)

1. **新建下载任务**：
   * 点击右上角 **“新建任务”** 按钮。
   * 粘贴单个或多个 HTTP/HTTPS/FTP 下载链接，或粘贴磁力链接 (`magnet:?xt=...`)。
   * 选择保存目录及线程数（默认 16 线程），点击 **“开始下载”**。

2. **打开保存目录与定位文件**：
   * 点击任务卡片右侧的 **文件夹图标**，系统将自动打开 Windows 资源管理器并高亮选中该文件。

3. **使用排障诊断面板**：
   * 若遇到连接断开或下载异常，点击顶部 Navbar 的 **“连接状态”** 标识。
   * 在弹出的诊断面板中，可查看详细的 Aria2 运行参数与后台控制台输出日志，并可点击 **“复制日志”** 快捷反馈。

