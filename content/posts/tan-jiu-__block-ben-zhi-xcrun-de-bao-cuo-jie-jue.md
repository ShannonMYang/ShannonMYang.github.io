---
title: "探究__block本质时，xcrun的报错解决"
slug: "tan-jiu-__block-ben-zhi-xcrun-de-bao-cuo-jie-jue"
date: "2020-07-28T08:35:26.000Z"
kind: "post"
tags: ["iOS"]
cover: "/post-images/tan-jiu-__block-ben-zhi-xcrun-de-bao-cuo-jie-jue.jpg"
excerpt: "近期在研究 block ，探究底层的一些东西，遂用到了 xcrun 命令，但是莫名报错，于是就有了如下记录。"
legacy: true
---
> 近期在研究 `block`，探究底层的一些东西，遂用到了 `xcrun` 命令，但是莫名报错，于是就有了如下记录。

#### 在 `main.m` 所在的文件目录下，输入如下命令行

```
xcrun -sdk iphoneos clang -arch arm64 -rewrite-objc main.m
```

#### 报错如下：

![xcrun error](/post-images/1595925545373.png)

#### 分析：

> 由报错可知，在当前路径下，找不到文件。那应该是 `Xcode` 的路径的问题，输入如下命令，

```
xcode-select --print-path
```

> 见打印。

![xcode路径](/post-images/1595925783330.png)

> 输入如下命令，验证路径是否正确

```
xcodebuild -showsdks
```

> 果然错误

![xcode路径验证](/post-images/1595926393128.png)

> 输入命令，更改错误路径

```
sudo xcode-select --switch /Applications/Xcode.app/
```

> 再做路径正确与否的验证，输入命令

```
xcodebuild -showsdks
```

> 验证结果

![更换路径后验证](/post-images/1595927223546.png)

> 再运行 `xcrun` 命令，成功无错误

![xcrun成功运行](/post-images/1595927425547.png)
