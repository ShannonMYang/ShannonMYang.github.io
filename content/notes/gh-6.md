---
title: "npm run dev 和 npm run serve"
slug: "gh-6"
date: "2021-04-12T13:07:53Z"
updated: "2021-04-12T13:07:53Z"
kind: "note"
tags: []
accent: "#8a7a63"
issue: 6
issueUrl: "https://github.com/ShannonMYang/MyPersonalBlog/issues/6"
repo: "ShannonMYang/MyPersonalBlog"
comments: 0
excerpt: "1、ERR 引发的思考 创建好的 vue 项目直接执行 vue run dev 报错？运行 vue run serve 就可以启动... 如下 --- 2、dev build serve? 其实 npm run dev 或者是 npm run serve 等 npm run xxx 并不是一定要这么写。 npm run XXX 是执行配置在 package.json 中的脚本，比如： npm ru…"
source: "github"
---

### 1、ERR 引发的思考
创建好的 vue 项目直接执行 vue run dev 报错？运行 vue run serve 就可以启动... 如下
```
npm run dev
npm ERR! missing script: dev

npm ERR! A complete log of this run can be found in:
npm ERR!     E:\nodejs\node_cache\_logs\2018-12-12T15_06_08_674Z-debug.log
```

---

### 2、dev build serve?
其实 npm run dev 或者是 npm run serve 等 npm run xxx 并不是一定要这么写。
npm run XXX 是执行配置在 package.json 中的脚本，比如：
```
"scripts": {
　　"serve": "vue-cli-service serve",
　　"build": "vue-cli-service build",
　　"lint": "vue-cli-service lint"
},
```
npm run xxx 中的 xxx 可以理解为键值对的 key，实际上 run 的是在 package.json 里面 scripts 配置的 value；

比如，npm run serve 实际运行的是 vue-cli-service serve；

而放在 3.0 以前运行的则是 node build/dev-server.js 文件；

这时候我们再来看上边的问题是不是豁然了呢， scripts 中并没有配置 dev ，所以控制台报了 [missing script: dev] 的错误 ；

---

### 3、总结
npm run xxx，并不是你想运行就运行的，只有在 package.json scripts 配置了，你才能 run 的，所以不是所有的项目都能 npm run dev/build。

要了解这些命令做了什么，就要去 scripts 中看具体执行的是什么代码。

这里就像是一些命令的快捷方式，免去每次都要输入很长的的命令（比如 serve 那行）

一般项目都会有 build, dev, unit 等，所以起名，最起码要从名字上基本能看出来是干什么的。
