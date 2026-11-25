---
title: "iOS 利用 Runtime 自定义导航控制器返回手势"
slug: "ios-li-yong-runtime-zi-ding-yi-dao-hang-kong-zhi-qi-fan-hui-shou-shi"
date: "2019-06-15T12:00:00+08:00"
kind: "post"
tags: ["iOS"]
cover: ""
excerpt: "自 iOS7 之后 ，系统的导航控制器就具备了 边缘滑动返回 的功能。 这一改进，使得用户能够很方便的退出当前页面，大屏的用户也不用再费力的去点击导航栏上的返回按钮，很是 人性化 。"
legacy: true
---
> 自 `iOS7 之后`，系统的导航控制器就具备了 `边缘滑动返回` 的功能。
> 这一改进，使得用户能够很方便的退出当前页面，大屏的用户也不用再费力的去点击导航栏上的返回按钮，很是`人性化`。

> 但是，有些用户觉得这样还是不方便。只能从边缘滑动哪行？我要的是全屏都能滑！
> 于是乎，很多应用，比如 QQ、知乎等都实现了这一功能。
> 想要实现这一功能，有好多种方法。

> 本文要介绍的这种方法，是比较好玩的一种方法。
> 因为我们用到了`苹果私有的 API`。
> 虽然违反了苹果的审核政策，但我们自有办法能躲过苹果的检测。
> 下面，就来聊一下实现过程。

#### 1\. 首先，我们需要知道系统的侧滑手势是如何实现的；

> 这个手势属于 `UINavigationController`，我们就跳到它的头文件里看看能不能找到线索。这个思路是正确的，确实有一个手势叫做 `interactivePopGestureRecognizer`。属性为 `readonly`，就是说我们不能给他换成自定义的手势，但是可以设置 `enable=NO`。那，既然找到了它，就打印一下，看看它到底是一个什么手势。

```Objective-C
 <
   UIScreenEdgePanGestureRecognizer: 0x7f99d1e10ba0;
   state = Possible;
   delaysTouchesBegan = YES;
   view = <UILayoutContainerView 0x7f99d1e0b7f0>;
   target= <(action=handleNavigationTransition:,
   target=<_UINavigationInteractiveTransition 0x7f99d1e0fc10>)>
   >
```

> 可以看到，这个手势属于 `UIScreenEdgePanGestureRecognizer` 这个类，它`继承`自 `UIPanGestureRecognizer`，是专门处理`边缘手势`的一个类。我们可以通过打印发现它的 `target：_UINavigationInteractiveTransition`（这是一个私有的类，用于处理导航栏动画的），`action：handleNavigationTransition:` (这个就是系统实现导航栏动画的私有方法)。我们要做的，就是自己新建一个 `UIPanGestureRecognizer` 手势，让它的 `target` 和 `action` 和系统的相同。

#### 2\. 以非常规手法获取系统手势；

> 我们要获取系统的侧滑手势的 `target`，用常规的手法肯定是获取不到的。
> 因为这是系统私有属性。
> 我们需要用 `runtime` 遍历它的成员变量，看一下系统是如何存储这个属性的。

```Objective-C
    unsigned int count;
    Ivar *ivar = class_copyIvarList([UIGestureRecognizer class], &count);
    for (int i = 0; i < count; i++) {
        Ivar var = ivar[i];
        NSLog(@"type:===>%s",ivar_getTypeEncoding(var));
        NSLog(@"name:===>%s",ivar_getName(var));
    }
```

##### `下面是打印结果，此处只取了两条有用的结果：`

```Objective-C
2015-09-24 15:10:30.879 Nav[1897:149271] type:===>@"NSMutableArray"
2015-09-24 15:10:30.879 Nav[1897:149271] name:===>_targets
```

##### `我们再来打印一下这个 _targets 数组，看看里面是什么:`

```Objective-C
NSMutableArray *_targets = [systemPopGes valueForKey:@"_targets"];
NSLog(@"%@",_targets);
```

##### `打印结果如下：`

```Objective-C
("(action=handleNavigationTransition:, target=<_UINavigationInteractiveTransition 0x7fcd0b5195c0>)")
```

##### 可以看到，可变数组里存储的，就是系统实现 `导航栏动画` 的 `target` 和 `action`，获取这个数组的 `key` 就是 `_targets`。

#### 3\. 以自己的手势，替换系统的手势；

> 我们可以通过 `KVC` 获取系统存储这个 `target-action` 的 `数组`，然后获取系统的 `target-action`，自己创建一个滑动手势，加入到系统实现侧滑手势所在的 `view` 中，禁用系统的侧滑手势，我们自定义的手势就可以代替系统的手势，实现滑动了。

##### `代码如下：`

```Objective-C
#import "SYRNavigationController.h"
#import <objc/runtime.h>

@interface SYRNavigationController () <UIGestureRecognizerDelegate>

@end

@implementation SYRNavigationController

- (void)viewDidLoad {
    [super viewDidLoad];

//    获取系统原有侧滑手势
    UIGestureRecognizer *systemPopGes = self.interactivePopGestureRecognizer;
//   禁用系统侧滑手势
    systemPopGes.enabled = NO;

//    自定义滑动手势
    UIPanGestureRecognizer *syrPan = [[UIPanGestureRecognizer alloc] init];
    syrPan.delegate = self;
    syrPan.maximumNumberOfTouches = 1;
//    向系统实现侧滑手势的view中加入自定义的滑动手势
    [systemPopGes.view addGestureRecognizer:syrPan];

    self.navigationBarHidden = YES;  //隐藏Tabbar

//    获取系统手势的target数组
    NSMutableArray *_targets = [systemPopGes valueForKey:@"_targets"];

    /**
     *  获取它的唯一对象，我们知道它是一个叫UIGestureRecognizerTarget的私有类，它有一个属性叫_target
     */
    id gestureRecognizerTarget = [_targets firstObject];
    /**
     *  获取_target:_UINavigationInteractiveTransition，它有一个方法叫handleNavigationTransition:
     */
    id navigationInteractiveTransition = [gestureRecognizerTarget valueForKey:@"_target"];
    /**
     *  通过前面的打印，我们从控制台获取出来它的方法签名。
     */
    SEL handleTransition = NSSelectorFromString(@"handleNavigationTransition:");
    /**
     *  创建一个与系统一模一样的手势，我们只把它的类改为UIPanGestureRecognizer
     */
    [syrPan addTarget:navigationInteractiveTransition action:handleTransition];
}

- (BOOL)gestureRecognizerShouldBegin:(UIGestureRecognizer *)gestureRecognizer {
//    这里有两个条件不允许的手势执行，1、当前控制器为根控制器；2、如果这个push、pop动画正在执行（私有属性）
//    即在根视图或者正在滑动时禁用手势
    return self.viewControllers.count != 0 && ![[self valueForKey:@"_isTransitioning"] boolValue];
}

@end
```

> 以上就是简单的实现了一个自定义导航栏滑动手势的 `UINavigationController`，只要继承这个导航控制器，就可以全局实现`全屏侧滑手势`，当然系统版本一定要在 `iOS7.0` `以上` 才行。

#### 4\. 规避被拒的风险，私有API的调用的隐匿处理；

> 在刚开始的时候我说到这个方法涉及`苹果私有 API`，在发布时可能有`被拒`的`风险`，我们可以通过下面的方法简单的`避免`。

##### `代码如下：`

```Objective-C
NSString *selectorStringBegin = @"handleNavigation";
NSString *selectorStringEnd = @"Transition:";
NSString *selectorString = [NSString stringWithFormat:@"%@%@",selectorStringBegin,selectorStringEnd];
SEL systemAction = NSSelectorFromString(selectorString);
```
