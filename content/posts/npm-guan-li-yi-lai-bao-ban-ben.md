---
title: "npm 管理依赖包版本"
slug: "npm-guan-li-yi-lai-bao-ban-ben"
date: "2019-07-17T12:00:00+08:00"
kind: "post"
tags: ["Vue.js"]
cover: ""
excerpt: "近来，在做一些 vue.js 相关的练习，用到了很多 npm 管理依赖包的问题。遂，有此笔记，做一记录。"
legacy: true
---
> 近来，在做一些 vue.js 相关的练习，用到了很多 npm 管理依赖包的问题。遂，有此笔记，做一记录。

-   #### npm 管理 node 版本

##### 1\. 安装：

```Shell
$ sudo npm install -g n
```

##### 2\. 查看当前已经安装的 node 版本以及正在使用的版本（前面有一个 o）

```Shell
$ n
```

##### 3\. 安装其他的 node 版本

```Shell
//安装0.11.12版本
$ n 0.11.12
//安装最新的版本
$  n latest
//安装稳定版本
$  n stable
// 删除某个版本
$ n rm 0.10.1
```

##### 4\. 以指定的版本来执行脚本

```Shell
$ n use 0.10.21 some.js
```

---

-   #### 使用 nrm 切换 npm 源

```Shell
// 安装nrm：
npm install -g nrm
// 查看已有的可以使用的源
nrm ls
// 测试源的速度
nrm test
// 切换到现有的源 如  nrm use taobao 之后使用npm就会从taobao下载
nrm use <源名称>
// 新增源
nrm add<源名称> <源地址>
```

---

-   #### 部分常用命令

##### 1\. 安装命令

```Shell
// 全局安装
npm install 模块名 -g
// 本地安装
npm install 模块名
// 一次性安装多个
npm install 模块1 模块2 模块3
// 安装开发时依赖包
npm install 模块名 --save-dev
// 安装运行时依赖包
npm install 模块名 --save
```

##### 2\. 查看安装的目录

```Shell
// 查看项目中模块所在的目录
npm root
// 查看全局安装的模块所在目录
npm root -g
```

##### 3\. 查看某个包的各种属性

```Shell
// 查看某个包对于各种包的依赖关系
npm view 模块名 dependencies
```

##### 4\. 查看包的源文件地址

```Shell
// 查看包的源文件地址
npm view 模块名 repository.url
```

##### 5\. 查看 npm 的版本

```Shell
npm -v
```

##### 6\. 查看某个模块的 bugs 列表界面

```Shell
npm bugs 模块名
// 例如运行npm bugs antd则会打开antd仓库的issue
```

##### 7\. 打开某个模块的仓库界面

```Shell
npm repo 模块名
// 例如运行npm repo vue则会打开vue线上仓库，效果如下图
```

##### 8\. 打开某个模块的文档

```Shell
npm docs 模块名
// 例如运行npm docs vue则会打开vue的readme.md文档
```

##### 9\. 打开某个模块的主页

```Shell
npm home 模块名
// 例如运行npm home vue则会打开vue模块的主页
```

##### 10\. 查看当前已经安装的模块

```Shell
npm list
// 当然我们也可以限制输入的模块层级，例如
npm list --depth=0
```

##### 11\. 清除未被使用到的模块

```Shell
// 有时在我们使用npm list的时候，可能会碰到一些问题，就是有些模块并没有被项目引用使用，我们还是安装了这些模块，那么我们可以一键清除这些没有使用到的模块
npm prune
```

##### 12\. 初始化

```Shell
npm init
// 引导你创建一个package.json文件，包括名称、版本、作者这些信息
```

##### 13\. 清除 npm 的缓存

```Shell
rm -rf node_modules
npm cache clean
// 慎重使用改命令
npm cache clean -f
```

##### 14\. 卸载 node 模块

```Shell
npm uninstall 模块名
```

##### 15\. 更新 node 模块

```Shell
npm update 模块名
// 当然你也可以update 该模块到指定版本
npm update 模块名 @版本号
// 如果安装到最新版本可以使用以下命令
npm install 模块名@latest
```

##### 16\. 查看当前模块依赖的 node 最低版本号

```Shell
npm view 模块名 engines
```

##### 17\. 查看模块的当前版本号

```Shell
npm view 模块名 version
// 需要注意的是查看到的模块版本是该模块再远程仓库的版本号，并不是当前项目中所依赖的版本号。
// 查看当前项目中应用的某个模块的版本号的命令为
npm list 模块名 version
```

---

-   #### 语义化版本号

-   每个版本号都形如 1.2.3，由三个部分组成，依次叫做 “主版本号”、“次版本号” 和 “修订号”
-   当新版本无法兼容基于前一版本的代码时，则提高主版本号
-   当新版本新增了功能与特性，但仍兼容前一版本的代码时，则提高次版本号
-   当新版本仅仅修正漏洞或者增强效率，仍然兼容前一版本代码，则提高修订号
-   默认情况下，npm install --save 下载的都是最新版本，并且会在 package.json 文件里登记一个最优版本号，

```Shell
"cluster": ">= 0.7.7",
 // cluster 版本必须大于等于 0.7.7 或者限定版本范围 npm install cluster@">=0.7.7<0.8.0"
"commander": "^2.6.0",
/* ^会匹配最新的大版本依赖包，=大版本不变即可,其他版本随便更新。
当我们npm install 的时候,安装到 node_modules 目录下的
 commander开源包可能是 2.6.0 或 2.7.3 或 2.8.9 ......不包括3.0.0
只要前面2不变即可.这种版本限制相对对宽松,还是少用为妙.*/
"commander": "~1.2.3",
/* ~会匹配最近的小版本依赖包，比如~1.2.3会匹配所有1.2.x版本，
但是不包括1.3.0*/
"async" : "1.2.3",
// 指定特定的版本号 npm install async@1.2.3
"async" : "*",
// 最糟糕的一种版本控制,一点限制没有.
```

---

-   #### 使用 npm shrinkwrap 命令锁定项目依赖

> 在开发某个 Node 项目时，进行到某个节点，一切都运行顺利，说明目前所有的依赖包（以及更底层的依赖包）和你的代码兼容得很好。这个时候，就可以在项目文件夹下运行上面的这个命令。它会生成一个 npm-shrinkwrap.json 文件，记录目前所有依赖包（及更底层依赖包）的版本信息。这样当以后你（或者你的同事、你的用户）运行 npm install 命令时，npm 首先会找 npm-shrinkwrap.json 文件，依照其中的信息来准确地安装每一个依赖包，只有当这个文件不存在时，npm 才会使用 package.json。
> 在这之后开发的过程中，如果想要更新某个依赖包，比如将 Express 从 4.13.0 更新到 4.14.1，那么就只需 npm install express@4.14.1；或者想要添加新的依赖包，比如 Helmet，也只需 npm install helmet。经过一段时间的测试与开发，当你确定这些新版本新安装的依赖包与自己的代码兼容后，就可以再次运行 npm shrinkwrap 命令来锁定依赖包的版本。

> 如果 package-lock.json 和 npm-shrinkwrap.json 存在于包的根，package-lock.json 将被完全忽略。

```Shell
// 在（当前机器的当前用户的）所有项目禁用 package-lock.json
npm config set package-lock false
```

---

-   #### 查看 npm 的配置

```Shell
npm config list
```

---

-   #### 更换源

```Shell
// 要更换国内镜像，编辑 ~/.npmrc 加入下面内容
registry = https://registry.npm.taobao.org
```
