---
title: "iOS 打破 NSTimer 循环引用"
slug: "ios-da-po-nstimer-xun-huan-yin-yong"
date: "2019-06-26T12:00:00+08:00"
kind: "post"
tags: ["iOS"]
cover: ""
excerpt: "在做 iOS 项目 ，多多少少都会有不留意时候，碰到一些 NSTimer 的 循环引用问题 。 本篇笔记意在记录解决 NSTimer 循环引用问题的方法。"
legacy: true
---
> 在做 `iOS 项目`，多多少少都会有不留意时候，碰到一些 `NSTimer` 的 `循环引用问题`。
> 本篇笔记意在记录解决 NSTimer 循环引用问题的方法。

> 本篇笔记将逐一列出解决方法，并附上具体代码实现。

#### 1\. 一种方式 打断循环引用 通过弱引用 但必须是在 block 中。

##### `代码调用及实现，如下：`

```Objective-C
__weak typeof(self) weakSelf = self;
self.timer = [NSTimer scheduledTimerWithTimeInterval:1.0 repeats:YES block:^(NSTimer * _Nonnull timer) {
    [weakSelf timerLog];
}];
```

#### 2\. 自己实现一个 block 打破循环引用 （个人感觉，略复杂）。

##### `代码调用如下：`

```Objective-C
self.timer = [NSTimer dix_timerWithTimeInterval:1 repeats:YES block:nil];
```

##### `代码实现如下：`

```Objective-C
+ (NSTimer *)dix_timerWithTimeInterval:(NSTimeInterval)interval repeats:(BOOL)repeats block:(void (^)(NSTimer *))block
{
     return [self scheduledTimerWithTimeInterval:interval target:self selector:@selector(timerAction:) userInfo:[block copy] repeats:repeats];
}

//通过 Block 打破循环引用，解决 Timer 无法释放的问题
+ (void)timerAction:(NSTimer *)timer
{
//    void (^block)(NSTimer *tiemr) = timer.userInfo;
//    声明Block
    void (^ block)(NSTimer *) = ^(NSTimer *timer) {
        timer = timer.userInfo;
    };
    NSLog(@"%s", __func__);
    if (block) {
        block(timer);
    }
}
```

#### 3\. 创建中间对象 打破循环引用

##### `代码调用如下：`

```Objective-C
self.timer = [NSTimer scheduledTimerWithTimeInterval:1 target:[dixProxy1 dixProxyWithTarget:self] selector:@selector(timerLog) userInfo:nil repeats:YES];
```

##### `代码实现如下：`

```Objective-C
// disProxy1.m
+ (instancetype)dixProxyWithTarget:(id)target
{
    dixProxy1 *proxy = [[dixProxy1 alloc] init];
    proxy.target = target;
    return proxy;
}
// 利用runtime的消息转发机制
- (id)forwardingTargetForSelector:(SEL)aSelector {
    return self.target;
}
```

#### 4\. 效率更高 NSProxy , 专门用来做转发的

##### `代码调用如下：`

```Objective-C
/**
 * 因为在调用 timeLog 方法的时候，发现自身没有，就会自动进入消息转发，进而调用方法
 * 而不是像继承自 NSObject，还要在自身没有方法之后，去查找superClass 内是否有方法
 * 故而 效率更高
 */
self.timer = [NSTimer scheduledTimerWithTimeInterval:1.0 target:[dixProxy2 dixProxyWithTarget:self] selector:@selector(timerLog) userInfo:nil repeats:YES];
```

##### `代码实现如下：`

```Objective-C
+ (instancetype)dixProxyWithTarget:(id)target
{
    // NSProxy 对象不需要调用init方法， 因为 NSProxy本来就没有 init 方法
    dixProxy2 *proxy = [dixProxy2 alloc];
    proxy.target = target;
    return proxy;
}

- (NSMethodSignature *)methodSignatureForSelector:(SEL)sel {
    return [self.target methodSignatureForSelector:sel];
}

- (void)forwardInvocation:(NSInvocation *)invocation {
    [invocation invokeWithTarget:self.target];
}
```
