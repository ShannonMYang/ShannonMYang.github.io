---
title: "Vue.js 中引入 Font Awesome 字体图标"
slug: "vuejs-zhong-yin-ru-font-awesome-zi-ti-tu-biao"
date: "2019-12-24T12:00:00+08:00"
kind: "post"
tags: ["Vue.js"]
cover: ""
excerpt: "这，基本是一个被写烂了的话题，但是，我刚接触，我的博客里也没有。故而，有此记录。"
legacy: true
---
> 这，基本是一个被写烂了的话题，但是，我刚接触，我的博客里也没有。故而，有此记录。

#### 1\. 安装基础依赖

> 进入 Vue 项目文件夹，执行如下命令安装基础依赖库。

```JavaScript
npm i --save @fortawesome/fontawesome-svg-core
npm i --save @fortawesome/vue-fontawesome
```

#### 2\. 安装样式依赖

> Font Awesome 为我们提供了 Solid、Regular、Brands 这三种免费样式（日常使用完全够用），执行如下命令安装。

```JavaScript
npm i --save @fortawesome/free-solid-svg-icons
npm i --save @fortawesome/free-regular-svg-icons
npm i --save @fortawesome/free-brands-svg-icons
```

#### 3\. 修改 src/main.js

> 添加如下代码全局引入并配置 Font Awesome，之后我们就可以使用它了。

```JavaScript
// 引入fontawesome-icon
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon, FontAwesomeLayers, FontAwesomeLayersText } from '@fortawesome/vue-fontawesome'

library.add(fas, far, fab)

Vue.component('font-awesome-icon', FontAwesomeIcon)
Vue.component('font-awesome-layers', FontAwesomeLayers)
Vue.component('font-awesome-layers-text', FontAwesomeLayersText)
```

#### 4\. 基本使用

##### 4.1 显示图标

> a. 我们使用 font-awesome-icon 标签来显示图标，icon 属性中可以设置样式前缀、以及图标名字。

```JavaScript
<font-awesome-icon :icon="['fas', 'square']"/>
<font-awesome-icon :icon="['far', 'square']"/>
<font-awesome-icon :icon="['fab', 'accessible-icon']"/>
```

> b. 如果是 solid 样式（前缀为：fas），则前缀可以省略。比如上面第一个图标等效下面写法：

```JavaScript
<font-awesome-icon icon="square"/>
```

##### 4.2 设置图标大小

> 默认情况下图标和当前文字的大小是一样的。我们可以通过 size 属性在此基础上作调整，该属性支持多种类型的设置方式。

```JavaScript
<font-awesome-icon icon="chess-knight"/>
<font-awesome-icon icon="chess-knight" size="xs"/>
<font-awesome-icon icon="chess-knight" size="lg"/>
<font-awesome-icon icon="chess-knight" size="2x"/>
```

##### 4.3 固定图标宽度

> 使用 fixed-width 可以固定图标宽度。

```JavaScript
<font-awesome-icon icon="home" fixed-width /> home <br>
<font-awesome-icon icon="child" fixed-width /> help <br>
<font-awesome-icon icon="cog" fixed-width /> settings <br>
```

##### 4.4 旋转图标

```JavaScript
<font-awesome-icon icon="chess-knight" rotation="0" />
<font-awesome-icon icon="chess-knight" rotation="90" />
<font-awesome-icon icon="chess-knight" rotation="180" />
<font-awesome-icon icon="chess-knight" rotation="270" />
```

##### 4.5 翻转图标

```JavaScript
<font-awesome-icon icon="chess-knight"  />
<font-awesome-icon icon="chess-knight" flip="horizontal" />
<font-awesome-icon icon="chess-knight" flip="vertical" />
<font-awesome-icon icon="chess-knight" flip="both" />
```

##### 4.6 旋转动画效果

###### 4.6.1 添加 spin 属性可以让图标不停地顺时针旋转；

```JavaScript
<font-awesome-icon icon="arrow-circle-down" spin />
```

###### 4.6.2 添加 pulse 属性同样可以让图标旋转，但它不像 spin 那样是均匀地变化角度，而是 0 度、45 度、90 度... 这样跳跃地变化

```JavaScript
<font-awesome-icon icon="arrow-circle-down" pulse />
```
