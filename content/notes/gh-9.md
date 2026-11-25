---
title: "React Native 的 Flex 布局"
slug: "gh-9"
date: "2021-04-21T01:45:56Z"
updated: "2021-04-25T05:45:09Z"
kind: "note"
tags: ["React Native", "CSS", "基础知识"]
accent: "#C6391F"
issue: 9
issueUrl: "https://github.com/ShannonMYang/MyPersonalBlog/issues/9"
repo: "ShannonMYang/MyPersonalBlog"
comments: 0
excerpt: "一般使用 ReactNative 开发 App, 一般都采用 Flex 布局，使用这套布局方式可以非常快速的布局。 React Native 中的 Flexbox 的工作原理和 web 上的 CSS 基本一致，当然也存在少许差异。 首先是默认值不同：flexDirection 的默认值是 column 而不是 row，而 flex 也只能指定一个数字值。 --- - #### Flex 简介 Fl…"
source: "github"
---

> 一般使用 ReactNative 开发 App, 一般都采用 Flex 布局，使用这套布局方式可以非常快速的布局。

> React Native 中的 Flexbox 的工作原理和 web 上的 CSS 基本一致，当然也存在少许差异。
> 首先是默认值不同：flexDirection 的默认值是 column 而不是 row，而 flex 也只能指定一个数字值。

---

- #### Flex 简介
> Flex 又叫弹性布局，会把当前组件看做一个容器，他的所有子组件都是他容器中的成员，通过 Flex，就能迅速的布局容器中的成员。
> 
> 使用场景：当想快速布局一个组件中所有子组件的时候，可以使用 Flex 布局

- #### Flex 主轴和侧轴
> Flex 中有两个主要的概念：主轴和侧轴
> 主轴与侧轴的关系：相互垂直的。
> 主轴：决定容器中子组件默认的布局方向：水平，垂直
>
> 侧轴：决定容器中子组件与主轴垂直的布局方向
>> 比如主轴水平，那么子组件默认就是水平布局排布，侧轴就是控制子组件在垂直方向的布局

- #### flexDirection 属性
> flexDirection: 决定主轴的方向，水平或者垂直，这样子组件就会水平排布或者垂直排布
> flexDirection 共有四个值，在 RN 中默认为 column。
```css
row  /* (默认值) 主轴为水平方向，从左向右。依次排列 */
row-reverse  /* 主轴为水平方向，从右向左依次排列 */
column  /* 主轴为垂直方向，默认的排列方式，从上向下排列 */
column-reverse  /* 主轴为垂直方向，从下向上排列 */
```

- #### flexWrap 属性
> flexWrap: 决定子控件在父视图内是否允许多行排列。
> flexWrap 共有两个值，默认为 nowrap。
```css
nowrap  /* 组件只排列在一行上，可能导致溢出 */
wrap   /* 组件在一行排列不下时，就进行多行排列 */
```

- #### justifyContent
> justifyContent: 决定子组件在主轴中具体布局，是靠左，还是居中等
> justifyContent 共有五个值，默认为 flex-start
```css
flex-start  /* 子组件向主轴起点对齐，如果主轴水平，从左开始，主轴垂直，从上开始 */
flex-end  /* 子组件向主轴终点对齐，如果主轴水平，从右开始，主轴垂直，从下开始 */
center  /* 居中显示，注意：并不是让某一个子组件居中，而是整体有居中效果 */
space-between  /* 均匀分配,相邻元素间距离相同。每行第一个组件与行首对齐，每行最后一个组件与行尾对齐 */
space-around  /* 均匀分配,相邻元素间距离相同。每行第一个组件到行首的距离和每行最后一个组件到行尾的距离将会是相邻元素之间距离的一半 */
```

- #### alignItems
> alignItems: 决定子组件在测轴中具体布局
>
>> 一直都没有管过侧轴，如果侧轴垂直，决定子组件在上，还是下，或者居中
>
> alignItems 共有四个值，默认为 stretch。
```css
flex-start  /* 子组件向侧轴起点对齐 */
flex-end  /* 子组件向侧轴终点对齐 */
center  /* 子组件在侧轴居中 */
stretch  /* 子组件在侧轴方向被拉伸到与容器相同的高度或宽度 */
```

- #### alignSelf
> alignSelf: 自定义自己的侧轴布局，用于一个子组件设置。
>> 注意：当某个子组件不想参照默认的 alignItems 时，可以设置 alignSelf，自定义自己的侧轴布局。
>
> alignSelf 共有五个值，默认为 auto。
```css
auto  /* 继承它的父容器的alignItems属性。如果没有父容器则为 "stretch" */
flex-start  /* 子组件向侧轴起点对齐 */
flex-end  /* 子组件向侧轴终点对齐 */
center  /* 子组件在侧轴居中 */
stretch  /* 子组件在侧轴方向被拉伸到与容器相同的高度或宽度 */
```

- #### flex
> flex: 决定子控件在主轴中占据几等分。
> flex: 任意数字，所有子控件 flex 相加，自己 flex 占总共多少，就有多少宽度.
