---
title: "macOS 中 常用 Homebrew 命令"
slug: "mac-shang-homebrew-chang-yong-ming-ling"
date: "2021-03-22T09:53:41.000Z"
kind: "post"
tags: ["mac", "iOS"]
cover: "/post-images/mac-shang-homebrew-chang-yong-ming-ling.jpg"
excerpt: "在macos上不用brew命令，你还要用什么来简化你的开发管理、日常使用管理呢？ 没错，就是那个去谷歌面试，因为二叉树被拒的开发者，开发的homebrew。"
legacy: true
---
> 在macos上不用brew命令，你还要用什么来简化你的开发管理、日常使用管理呢？
> 没错，就是那个去谷歌面试，因为二叉树被拒的开发者，开发的homebrew。

### macOS 中 常用 Homebrew 命令

#### 一、Homebrew官网

[Homebrew](https://brew.sh/)

#### 二、常用命令汇总

-   ##### 安装

```
//安装依赖工具
xcode-select --install

/usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
```

-   ##### 查看帮助信息

```
brew help
```

-   ##### 查看版本

```
brew -v
```

-   ##### 更新 Homebrew 自己

```
brew update
```

-   ##### 安装软件包

```
brew install [包名]

//安装git
brew install git

//安装git-lfs
brew install git-lfs

//安装wget
brew install wget

//安装openssl
brew install openssl
```

-   ##### 查询可更新的包

```
brew outdated
```

-   ##### 更新包 (formula)

```
//更新所有
brew upgrade

//更新指定包
brew upgrade [包名]
```

-   ##### 清理旧版本

```
//清理所有包的旧版本
brew cleanup

//清理指定包的旧版本
brew cleanup [包名]

//查看可清理的旧版本包，不执行实际操作
brew cleanup -n
```

-   ##### 锁定不想更新的包

```
//锁定某个包
brew pin $FORMULA
//取消锁定
brew unpin $FORMULA
```

-   ##### 卸载安装包

```
brew uninstall [包名]

//例：卸载git
brew uninstall git
```

-   ##### 查看包信息

```
brew info [包名]
```

-   ##### 查看安装列表

```
brew list
```

-   ##### 查询可用包

```
brew search [包名]
```

-   ##### 卸载 Homebrew

```
cd `brew --prefix`
rm -rf Cellar
brew prune
rm `git ls-files`
rm -r Library/Homebrew Library/Aliases Library/Formula Library/Contributions
rm -rf .git
rm -rf ~/Library/Caches/Homebrew
```

#### 三、参考文章

-   1、[你应该定期更新 Homebrew](https://segmentfault.com/a/1190000004353419)
-   2、[Homebrew 简介和基本使用](http://blog.csdn.net/andanlan/article/details/51589800)
-   3、[Mac 上 Homebrew 的使用 (Homebrew 使 OS X 更完整)](http://blog.csdn.net/delphiwcdj/article/details/19679891)
-   4、[HomeBrew 的安装和简单使用](http://blog.csdn.net/azhou_hui/article/details/49718511)
-   5、[Mac OS 下包管理器 Homebrew 的安装与使用](https://www.jianshu.com/p/d229ac7fe77d)
