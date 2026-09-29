# 灵清文档协作 Demo（Collabora Online）

这个项目已改为纯 **Collabora Online + WOPI** 架构，不再包含 SuperDoc。

## 已实现

- 上传 `.docx` 并创建带 access token 的临时 WOPI 文件
- WOPI `CheckFileInfo`、`GetFile`、`PutFile`
- 通过 iframe 和表单 token 启动 Collabora Online
- 通过官方 PostMessage 握手控制编辑器
- 外部 UI 在光标处插入文字（`Send_UNO_Command` / `.uno:InsertText`）
- 外部 UI 强制保存（`Action_Save`）并接收保存回执
- 查看保存版本并下载服务端保存的 DOCX

> Demo 的文件存储位于 Node 进程内存中；重启 Vite 后文件会清空。生产环境应把 `server/collaboraWopiPlugin.mjs` 中的 Map 替换为对象存储或文件服务，并把 token 接入业务鉴权。

## 本地启动

1. 复制环境变量：

   ```bash
   cp .env.example .env
   ```

2. 启动 Collabora CODE（macOS / Windows Docker）：

   ```bash
   docker run -d --name collabora-code -p 9980:9980 \
     -e "aliasgroup1=http://host.docker.internal:5174" \
     -e "extra_params=--o:ssl.enable=false --o:ssl.termination=false" \
     collabora/code:latest
   ```

3. 启动前端及内置 WOPI Host：

   ```bash
   pnpm install
   pnpm dev
   ```

4. 打开 `http://localhost:5174`，上传 DOCX。

## 地址配置

- `VITE_COLLABORA_URL`：浏览器访问 Collabora 的地址，默认 `http://localhost:9980`。
- `VITE_WOPI_PUBLIC_ORIGIN`：Collabora 容器回连 WOPI Host 的地址。macOS / Windows Docker 使用 `http://host.docker.internal:5174`；Linux 应换成宿主机局域网 IP。

如果 Collabora 部署在远端，两个地址都应改成对应的 HTTPS 可访问地址，并在 Collabora 中允许本项目的 WOPI Host 域名。

## 核心代码

- `src/components/CollaboraEditor.vue`：iframe 启动、来源校验、PostMessage 握手及命令。
- `server/collaboraWopiPlugin.mjs`：Demo WOPI Host 与上传/下载 API。
- `src/services/collaboraService.ts`：前端文件接入服务。
