---
title: "bug_解决 WKWebView 加载本地 css 文件无效"
slug: "bug_-jie-jue-wkwebview-jia-zai-ben-di-css-wen-jian-wu-xiao"
date: "2021-03-12T15:17:59.000Z"
kind: "post"
tags: ["iOS"]
cover: "/post-images/bug_-jie-jue-wkwebview-jia-zai-ben-di-css-wen-jian-wu-xiao.png"
excerpt: "最近笔者在研究React Native，遂遇到此问题，有此笔记。"
legacy: true
---
> 最近笔者在研究React Native，遂遇到此问题，有此笔记。

##### bug 背景:

> `Xcode 12.4` `Swift 5.4` `WKWebView`
>
> 模仿网易新闻的新闻页。
> 用 Charles 抓请求的 url, 获取从 url 请求回来的数据就带有 HTML 标签；
> 再引入自己写的本地 css 与 js 文件，拼接成 HTML 字符串；
> 用 WKWebView 的 - (nullable WKNavigation \*)loadHTMLString:(NSString \*)string baseURL:(nullable NSURL \*)baseURL; 方法加载字符串；
> 发现没有 css 样式，而直接把 WKWebView 换成 UIWebView 则可以

##### 解决办法:

必须设置 baseurl 为 bundle 路径，不能为 nil

```objective-c
// UIWebView的baseUrl可以为空；
// WKWebView的baseUrl不能为空，会加载不出css的样式。
[self.webView loadHTMLString:htmlString baseURL:[NSURL fileURLWithPath:[[NSBundle mainBundle] resourcePath]]];
```

ps:
当时查了好多资料，又是百度又是谷歌的，大多是加载本地 html 文件引入本地 css,js 文件无效，而未说本地无 html 文件的情况，因此做个记录
