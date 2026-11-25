---
title: "算法小记 · 斐波那契数列 + 青蛙跳台阶问题"
slug: "suan-fa-xiao-ji-fei-bo-na-qi-shu-lie-qing-wa-tiao-tai-jie-wen-ti"
date: "2018-11-05T12:00:00+08:00"
kind: "post"
tags: ["算法"]
cover: ""
excerpt: "写一个函数，输入 n ，求斐波那契数列中第 n 项的数值。"
legacy: true
---
> 写一个函数，输入 `n` ，求斐波那契数列中第 `n` 项的数值。

-   ###### 斐波那契数列定义如下：

f(n)\={0,n\=0;x,n\=1;f(n−1)+f(n−2),n\>1;f(n)=\\begin{cases} 0,\\quad n = 0; \\\\\\\\ x,\\quad n = 1;\\\\\\\\ f(n - 1) + f(n - 2),\\quad n > 1;\\end{cases} f(n)\=⎩⎪⎪⎪⎪⎪⎪⎨⎪⎪⎪⎪⎪⎪⎧​0,n\=0;x,n\=1;f(n−1)+f(n−2),n\>1;​

##### 1\. 最基本的方法（运用递归）

> 这个解法是最基本的方法，但是存在很严重的效率问题。
>
> 用树形结构图来分析的话，你会发现很多重复的结点。而重复的结点数会随着n的增大而急剧增加，这就意味着计算量会随着n的增大而急剧增大，导致时间变得巨长无比。
>
> 有兴趣的可以尝试输入第86项试试，感受一下什么叫做巨慢无比。

> 吾来打个样：

```C
#include <stdio.h>
/* 最基本的方法 */
long long Fibonacci(unsigned int n)
{
    if(n <= 0)
        return 0;
    //当只有一项的时候
    if(n == 1)
        return 1;
    //当不止有一项的时候
    return Fibonacci(n - 1) + Fibonacci(n - 2);
}

int main(int argc, const char * argv[]) {
    clock_t start, finish;
    double  duration;
    /* 测量一个事件持续的时间*/
    /* 起始 */
    start = clock();
    /* 要执行的代码，放在此处（两个clock方法的调用中间），方便测试出要执行的代码的执行时间 */
    printf("%lld\n", Fibonacci(11));
    /* 结束 */
    finish = clock();
    /* 时间 */
    duration = (double)(finish - start) / CLOCKS_PER_SEC;
    printf( "Use time is %f seconds.\n", duration );
    return 0;
}
```

##### 2\. 优化后的方法

> 其实改进的方法并不复杂，只需要避免1.最基本方法中的重复计算即可。
>
> 所以，我们可以把已经得到的数列中间项保存起来，如果下次需要计算的时候，先查找一下，如果已经计算过，就不用重复计算了。
>
> 当然，更简单的方法是，自下而上计算，首先根据f(0) 和f(1)算出f(2)，再根据f(1)和f(2)算出f(3)……依此类推，可以算出第n项。
>
> 那么，自然的，这种时间复杂度便是O(n)。

> 吾来打个样：

```C
#include <stdio.h>
/* 优化后的方法 */
long long Fibonacci(unsigned n)
{
    int result[2] = {0, 1};
    if(n < 2)
        return result[n];

    long long  fibNMinusOne = 1;
    long long  fibNMinusTwo = 0;
    long long  fibN = 0;
    for(unsigned int i = 2; i <= n; ++ i)
    {
        fibN = fibNMinusOne + fibNMinusTwo;

        fibNMinusTwo = fibNMinusOne;
        fibNMinusOne = fibN;
    }

    return fibN;
}

int main(int argc, const char * argv[]) {
    clock_t start, finish;
    double  duration;
    /* 测量一个事件持续的时间*/
    /* 起始 */
    start = clock();
    /* 要执行的代码，放在此处（两个clock方法的调用中间），方便测试出要执行的代码的执行时间 */
    printf("%lld\n", Fibonacci(11));
    /* 结束 */
    finish = clock();
    /* 时间 */
    duration = (double)(finish - start) / CLOCKS_PER_SEC;
    printf( "Use time is %f seconds.\n", duration );
    return 0;
}
```

##### 3\. 青蛙跳台阶问题

> 假如有一只青蛙，一次可以跳上 1 级台阶，也可以跳 2 级台阶，请问青蛙上一个 n 级台阶一共有多少种跳法？
> 分析如下：

1.  假如现在台阶只有 1 级，n = 1，那么这只青蛙就在只有 1 种跳法：1（1 代表一次跳 1 级台阶）也就是 f(1) = 1 种跳法
2.  假如现在台阶只有 2 级，n = 2，那么这只青蛙可以有 2 种跳法：1 1、2（1 代表一次跳 1 级台阶，2 代表一次跳 2 级台阶），也就是 f(2) = 2 种跳法
3.  假如现在台阶有 3 级，n = 3，青蛙可以有几种跳法呢？
    假如青蛙先跳了 1 级台阶，还剩下 2 级台阶，那它还有几种跳法呢？通过第 2 个情况分析知道有 2 种跳法；假如青蛙先跳了 2 级台阶，根据第 1 个情况分析知道有 1 种跳法，所以这时候得出 f(3) = 2 + 1 种方法
4.  假如现在台阶有 4 级，n = 4，我们利用上面的规律继续分析可得：f(4) = 3 + 2

综上所述，我们得出其实这个算法就是一个（变形）斐波那契数列问题，公式如下：

-   n = 1, f(1) = 1
-   n = 2, f(2) = 2
-   n > 2, f(n) = f(n -1) + f(n -2)

所以至此明白了，青蛙跳台阶问题就是一个（变形）斐波那契数列问题。

> 吾来打个样：

```C
#include <stdio.h>
/* 优化后的方法 */
long long Fibonacci(unsigned n)
{
    int result[2] = {0, 1, 2};
    if(n <= 2)
        return result[n];

    long long  fibNMinusOne = 2;
    long long  fibNMinusTwo = 1;
    long long  fibN = 0;
    for(unsigned int i = 3; i <= n; ++ i)
    {
        fibN = fibNMinusOne + fibNMinusTwo;

        fibNMinusTwo = fibNMinusOne;
        fibNMinusOne = fibN;
    }

    return fibN;
}

int main(int argc, const char * argv[]) {
    clock_t start, finish;
    double  duration;
    /* 测量一个事件持续的时间*/
    /* 起始 */
    start = clock();
    /* 要执行的代码，放在此处（两个clock方法的调用中间），方便测试出要执行的代码的执行时间 */
    printf("%lld\n", Fibonacci(11));
    /* 结束 */
    finish = clock();
    /* 时间 */
    duration = (double)(finish - start) / CLOCKS_PER_SEC;
    printf( "Use time is %f seconds.\n", duration );
    return 0;
}
```
