# 材料与机构 · 独立工程学习手册

普通静态网站，不使用ChatGPT登录或API，支持GitHub Pages及其他静态托管。支持可选的Supabase邮箱密码登录与私人云端数据存储。

包含53篇通用知识及23道自测。保留搜索、分类、收藏、编辑、导入导出、文件归档及STL预览。个人自述案例未包含在待公开源码中。独立版源码不含原网站身份、密钥或云数据库。

## 数据在哪里

知识底稿随站点发布。未配置云端或未登录时，新增笔记、收藏和文件使用IndexedDB，保存在当前设备、浏览器及网站域名下。配置并登录Supabase后读写账号的云端记录，文件置于私有桶；不会自动把本机原数据上传，需点击迁移按钮。配置入口和逐步指南为`setup.html`，数据库脚本为`supabase/setup.sql`。

同步采用直接在线写入，30秒轮询与窗口重新获得焦点时刷新；编辑期间暂停自动刷新。写入失败不会回退为本地成功；相同记录的并行修改采用`updated_at`条件写入，过期版本拒绝覆盖。每台设备使用相同项目配置和同一学习账号即可读取同一份资料。

`public/sync-config.json`只允许项目URL与publishable/anon公开密钥，禁止填secret或service_role。浏览器登录后会保存会话，公共电脑请退出账号。SQL用RLS按`auth.uid()`隔离资料和文件目录；真正云端启用后还需用实际账号验证未登录、其他账号访问及跨设备读写。

本地模式换设备请导出知识备份，再在另一设备导入。JSON只包含知识与文件清单，不包含模型原文件。清理浏览器数据、隐私模式或变更域名可能导致本机数据不可见或丢失。原GPT网站的云端笔记与文件不会自动迁移；需要从原网站导出或下载。

## 本地开发

安装Node.js 24后运行：

```sh
npm install
npm run dev
npm run build
```

`web`为预先构建并随源码交付的静态网站，`base: './'`兼容GitHub Pages项目子目录。修改源码后需重新构建并提交`web`目录。部署工作流直接发布`web`，不依赖在线安装构建依赖。

## GitHub Pages发布

1. 在自己的GitHub账号创建仓库，例如`engineering-notebook`。不要上传个人案例备份或公司图纸。
2. 将本目录源码及`web`目录推送到`main`分支，排除`node_modules`与`dist`。
3. 在仓库`Settings → Pages → Build and deployment → Source`中选择`GitHub Actions`。
4. 等待`Publish engineering notebook`工作流成功，以其输出的地址为准。若第一次在启用Pages之前运行失败，可在Actions中重新运行。

普通公开GitHub Pages不会为访客提供私密空间；私有仓库也不能直接当作访客访问保护。个人内容仅在浏览器中导入，不要提交到公开仓库。

发布配置参考：
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## 离线单文件版

交付包另附`工程学习手册-独立离线版.html`，可用现代浏览器打开。它内嵌程序与通用知识，无需联网读取主界面；原文件迁移和资料来源链接需要自行处理。不同浏览器对file协议下的存储支持可能不同，重要编辑请及时导出备份。
