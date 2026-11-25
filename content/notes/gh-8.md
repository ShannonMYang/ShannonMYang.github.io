---
title: "React Native 的 CSS 布局"
slug: "gh-8"
date: "2021-04-21T01:17:27Z"
updated: "2021-04-25T15:15:26Z"
kind: "note"
tags: ["CSS", "基础知识"]
accent: "#26D2A5"
issue: 8
issueUrl: "https://github.com/ShannonMYang/MyPersonalBlog/issues/8"
repo: "ShannonMYang/MyPersonalBlog"
comments: 0
excerpt: "React Native 支持 CSS 中的布局属性，因此可以使用 CSS 布局属性。 --- - #### 视图边框 什么时候使用？想设置自己周边有边框的时候 > 注意点：一定要设置边框宽度 - #### 尺寸 - #### 外边距 设置组件与组件之间的间距 > 注意：第一个组件比较特殊，参照父组件，与父控件之间的间距。 >其他组件间距，相对于上一个组件 什么时候使用？想设置自己在父控件的位置的…"
source: "github"
---

> React Native 支持 CSS 中的布局属性，因此可以使用 CSS 布局属性。

---

- #### 视图边框
> 什么时候使用？想设置自己周边有边框的时候
>  
>> 注意点：一定要设置边框宽度
```css
borderBottomWidth number  /* 底部边框宽度 */
borderLeftWidth number  /* 左边框宽度 */
borderRightWidth number  /* 右边框宽度 */
borderTopWidth number  /* 顶部边框宽度 */
borderWidth number  /* 边框宽度 */
border<Bottom|Left|Right|Top>Color  /* 各方向边框的颜色,<>表示连着一起，例如borderBottomColor */
borderColor  /* 边框颜色 */
```

- #### 尺寸
```css
width number
height number
```

- #### 外边距
> 设置组件与组件之间的间距
>> 注意：第一个组件比较特殊，参照父组件，与父控件之间的间距。
>>其他组件间距，相对于上一个组件
>
> 什么时候使用？想设置自己在父控件的位置的时候使用
```css
margin number  /* 外边距 */
marginBottom number  /* 下外边距 */
marginHorizontal number  /* 左右外边距 */
marginLeft number  /* 左外边距 */
marginRight number  /* 右外边距 */
marginTop number  /* 上外边距 */
marginVertical number  /* 上下外边距 */
```
> 注意 marginRight 和 width 冲突，如果设置了 width，marginRight 无效。

- #### 内边距
> 设置子控件与当前控件的位置
>
> 什么时候使用？想设置自己的子控件相对自己的位置的时候使用
```css
padding number  /* 内边距 */
paddingBottom number  /* 下内边距 */
paddingHorizontal number  /* 左右内边距 */
paddingLeft number  /* 做内边距 */
paddingRight number  /* 右内边距 */
paddingTop number  /* 上内边距 */
paddingVertical number  /* 上下内边距 */
```

- #### 相对定位和绝对定位
**边缘**
```css
left   number  /* 左边缘 */
right  number  /* 右边缘 */
top    number  / * 顶部边缘 */
bottom number  /* 底部边缘 */
```
**定位 (position)**
> 通过 "left", "top", "right" 以及 "bottom" 边缘属性进行定位。
```css
absolute  /* 绝对定位，参照父控件位置定位 */
relative  /* 相对定位，参照当前控件原始位置定位 */
```

> 什么时候使用绝对定位，当想把一个已经设置了宽度的控件快速的放在左下角，右下角的时候，可以使用绝对定位。
>
> 什么时候使用相对定位，当想相对自己做出一些改变的时候，采用相对定位，比如相对自己，往下移动一点
