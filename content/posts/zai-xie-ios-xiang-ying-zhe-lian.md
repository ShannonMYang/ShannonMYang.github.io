---
title: "再写 iOS 响应者链"
slug: "zai-xie-ios-xiang-ying-zhe-lian"
date: "2018-07-18T12:00:00+08:00"
kind: "post"
tags: ["iOS"]
cover: ""
excerpt: "最近看到群里讨论有关响应者链的相关面试题。扪心自问，知道一部分，但是不够全。给自己一种青黄不接的感觉。 遂，决定温故一下 iOS 响应者连。再细细看看，发现一下以前没注意的地方。"
legacy: true
---
> 最近看到群里讨论有关响应者链的相关面试题。扪心自问，知道一部分，但是不够全。给自己一种青黄不接的感觉。
> 遂，决定温故一下 iOS 响应者连。再细细看看，发现一下以前没注意的地方。

#### iOS 事件传递和响应机制

##### 1\. 按时间顺序，事件的生命周期如下：

> 事件的产生和传递 (事件如何从父控件传递到子控件并寻找到最适合的 view、寻找最合适的 view 的底层实现、拦截事件的处理 --> 找到最合适的 view 后事件的处理（touches 方法的重写，也就是事件的响应）

##### 2\. 难点和重点：

a. 怎样找到最合适的 view；
b. 找到最合适的 view 的底层实现（即 `- (nullable UIView *)hitTest:(CGPoint)point withEvent:(nullable UIEvent *)event;` 的实现）；

##### 3\. iOS 中的事件：

a. 触摸事件
b. 加速计事件
c. 远程控制事件

##### 4\. 响应者对象 (`UIResponder`)：

iOS 中，只有继承了 `UIResponder` 的对象才能接受并处理事件。我们称之为 “响应者对象”；
比如：
a. UIApplication
b. UIViewController
c. UIView

##### 5\. 事件的处理：

> 为什么继承自 UIResponder 的类就能接收并处理事件？

```Objective-C
// 因为 UIResponder 中提供了4个对象方法来处理事件；

// 以 UIView 为例来说明触摸事件的处理；
// UIView 是 UIResponder 的子类，可以用覆盖下列4个方法处理不同的触摸事件；

// 一或多根手指开始触摸 view ，系统会自动调用下面的 view 方法；
- (void)touchesBegan:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event;

// 一或多根手指离开 view ，系统会自动调用下面的方法；
- (void)touchesEnded:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event;

// 一或多根手指在 view 上移动，系统会自动调用下面的方法（并且，随着手指的持续移动，会持续调用该方法）
- (void)touchesMoved:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event;

// 触摸结束前，某个系统事件（如电话呼入）会打断触摸过程，系统会自动调用下面的方法；
- (void)touchesCancelled:(NSSet<UITouch *> *)touches withEvent:(UIEvent *)event;

// 提示：touches 中存放的是 UITouch 对象；
```

> 需要注意的是：以上四个方法是由系统自动调用的。
> 所以，可以通过重写以上四种方法来处理一些事件。

-   当用户用一根手指触摸屏幕时，会创建一个与手指相关的 UITouch 对象；
-   如果两根手指同时触摸一个 view，那么 view 只会调用一次 - (void)touchesBegan:(NSSet<UITouch \*> \*)touches withEvent:(UIEvent \*)event; 方法，touches 参数中装着 2 个 UITouch 对象；
-   如果这两根手指一前一后分开触摸同一个 view，那么 view 会分别调用 2 次 - (void)touchesBegan:(NSSet<UITouch \*> \*)touches withEvent:(UIEvent \*)event; 方法，并且每次调用时的 touches 参数中只包含一个 UITouch 对象；
-   重写以上四个方法，如果是处理 UIView 的触摸事件。必须自定义一个继承自 UIView 的子类。由于 Apple 不开源一些 Objective-C 源码。所以，只能通过子类继承父类，重写方法的方式来处理 UIView 的触摸事件；
-   上面说的是处理 UIView 触摸事件，而不是 UIViewController 的触摸事件。要处理 UIViewController 的触摸事件，在控制器内直接重写以上四个方法即可；

##### 6\. UITouch 的作用：

-   保存着跟手势相关的信息，比如触摸的位置、时间、阶段；
-   当指针移动时，系统会更新同一个 UITouch 对象，使之能够一直保持该手指在触摸的位置；
-   当手指离开屏幕的时候，系统会自动调用方法，销毁相应的 UITouch 对象；
-   提示：iOS 开发中，要尽量避免使用双击事件；

##### 7\. iOS 事件的产生和传递：

###### a. 事件的产生：

-   发生触摸事件后，系统会将该事件加入到一个由 UIApplication 管理的事件队列中，为什么是队列而不是栈？因为队列的特点是 FIFO，即先进先出。先产生的事件先处理才符合正常逻辑（即日常生活所见），所以把事件添加到队列。
-   UIApplication 会从事件队列中取出最前面的事件，并将事件分发下去以便处理。通常，会先把事件发送给应用程序的主窗口（即 keyWindow）。
-   主窗口会在视图层次结构中找到一个最合适的视图来处理触摸事件，这也是整个事件处理过程的第一步。找到合适的视图控件后，就会调用视图控件的 touches 方法来作具体的事件处理。

###### b. 事件的传递
