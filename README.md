# koa-combo-static

- [Install](#install)
- [Config Options](#config-options)
- [Transform](#transform)
    - [Uglify-Complie](#uglify-complie)
    - [CSSMini-Complie](#cssmini-complie)
    - [HTMLMini-Complie](#htmlmini-complie)
    - [Less-Complie](#less-complie)
    - [Sass-Complie](#sass-complie)
    - [Stylus-Complie](#stylus-complie)
    - [Nunjucks-Complie](#nunjucks-complie)
    - [Dot-Complie](#dot-complie)
    - [ArtTemplate-Complie](#arttemplate-complie)
- [Hooks](#hooks)

> koa2版本的静态资源、combo资源请求中间件

· 静态资源解析

· combo资源解析

· 支持远程文件资源解析

· 支持合并资源的本地combo请求map

· 支持文件资源在线编译转换

## Install

```sh
$ npm install --save koa-combo-static
```

## Config Options

1. 配置对象模式

 *   `root`:[`String`] 文件资源的本地根级目录(绝对路径)
 *   `charset`:[`String`] 文件编码格式 (Default: `utf-8`)
 *   `gzip`: [`Boolean`] 是否允许启动gzip压缩(Default:`false`)
 *   `maxAge`: [`Number`]  文件的最大缓存时间,单位`秒`(Default: `0`)
 *   `isweak`: [`Boolean`] 是否使用弱ETag (Default:`true`)
 *   `cacheControl`: 自定义文件的缓存控制内容,会覆盖maxAge的作用*Optional*
 *   `prefixOfStatic`:[`Array`] 静态文件资源的前缀路径 (Default: `['js','css','imgs','fonts','videos']`)
 *   `prefix`: [`Array`] 合并资源请求的前缀 (Default: [`combo_js`,`combo_css`,`combo_html`])
 *   `tag`: [`String`] combo资源请求的连接标签 (Default: `??`),
 *   `mini`: [`Boolean`] 是否允许压缩,如果为调试模式则不会执行文件资源的压缩(Default:`true`)
 *   `remoteCache`: [`Boolean`] 是否缓存远程文件至本地 (Default:`false`)
 *   `remoteMap`: [`Object`] 远程路由映射 *Optional*
```json
{
    "cdn.js.cn":"127.0.1"
}
```
 *   `dfttransform`:[`Array`] 允许使用的转换流 (Default:`["less","sass","stylus","nunjucks","dot","arttemplate","dust"]`), 模块内部默认会使用Uglify、CSSMini、HTMLMini这三个转换流

2. 链式API调用

 *   `root()、charset()、gzip()、maxAge()、isweak()、cacheControl()、tag()、mini()、remoteCache()`: 都是一个参数值调用形式:`fn(value)`
 *   `prefix(String|Array)`
 *   `prefixOfStatic(String|Array)`
 *   `dfttransform(String|Array)`:
 *   `remoteMap(key,value)`
        `key`:[`String`]远程地址别名 **Required**
        `value`:[`String`]实际的远程地址 **Required**
 *   `transform(ext,transformName,transformOptions,transformFactory)`:
        * `ext`: [`String`] 文件后缀名(含".") **Required**
        * `transformName`: [`String`] 转换流内部定义名称或自定义名称 **Required**
        * `transformOptions`: [`Object`] 转换流配置项 *Optional*
        * `transformFactory`: [`Function`] 转换流构建工厂 *Optional*
 *   `hooks(prefixName,options)`:
        * `prefixName`:[`String`] 当前路径钩子要挂在到哪个combo请求前缀的路由中**Required**
        * `options`: [`Object`]  **Required**
            * `dir`:[`String`] 此路径前缀访问的combo请求对应到的磁盘目录地址
            * `allow_ext`:[`Array`] 此路径前缀访问的combo请求中可以允许出现的资源文件后缀列表 **Required**
            * `realpath`:[`Function`] 解析每个combo文件,并得到实际文件路径(如果没有填写缓存文件,那么系统默认是在`root`路径内创建一个远程路由别名的文件夹)
            
Note: 
* `prefix`配置是用于过滤是否是combo请求的第一步
* `hooks()` API方法调用的参数`prefixName`属于[全局配置](#config-options)中的`prefix`定义的值

## Transform
> combo资源请求中涉及到的所有转换流

1. How to use `Transform`

```js
let kcombo = require('koa-combo-static')


kcombo(/*options*/)

    //使用koa-combo-static内部已提供的转换流
    .transform('.less','less',{/*options*/})

    //自定义新的转换流
    .transform('.less','less',{/*options*/},function factory(opts){
        //Note: opts参数 === 方法中的第三个参数
        /*return a transform Stream engine*/
    })


```

2. Supported `Transform`

Note:
* 内部已经内置了很多转换流,一般无需过多自定义

* 由于内部的转换流提供较多,故此可能出现多余现象
    1) 如果确认并不需要内部提供的大部分转换流的话:

        a. 则可以通过[全局配置](#config-options)`dftTransform`来设置哪些需要的

        b. 通过API `dftTransform()`调用来设置

    2) 反之,则默认全部

内部已经提供的转换流列表如下:

1. 模块内部必备的转换流
- [Uglify-Complie](#uglify-complie)
- [CSSMini-Complie](#cssmini-complie)
- [HTMLMini-Complie](#htmlmini-complie)

2. 样式处理的转换流
- [Less-Complie](#less-complie)
- [Sass-Complie](#sass-complie)
- [Stylus-Complie](#stylus-complie)

3. 模板引擎处理的转换流
- [Nunjucks-Complie](#Nunjucks-complie)
- [Dot-Complie](#dot-complie)
- [ArtTemplate-Complie](#arttemplate-complie)

#### Uglify-Complie

· 依赖
```sh
$ npm i --save uglify-js@3.0.25
```

· 作用 : 将js文件流内容执行压缩

#### CSSMini-Complie

· 依赖
```sh
$ npm i --save clean-css@4.1.7
```

· 作用 : 将css文件流内容执行压缩

#### HTMLMini-Complie

· 依赖
```sh
$ npm i --save clean-css@4.1.7
```

· 作用 : 将模板文件流内容执行压缩


#### Less-Complie

· 依赖
```sh
$ npm i --save less@2.7.2
```

· 作用 : 将.less文件流内容编译成纯css内容

#### Sass-Complie

· 依赖
```sh
$ npm i --save node-sass@4.5.3
```

· 作用 : 将.scss文件流内容编译成纯css内容

#### Stylus-Complie

· 依赖
```sh
$ npm i --save stylus@0.54.5
```

· 作用 : 将.styl文件流内容编译成纯css内容

#### Nunjucks-Complie

· 依赖
```sh
$ npm i --save nunjucks
```

· 作用 : 将.html或.njk文件流内容编译成纯HTML内容

#### Dot-Complie

· 依赖
```sh
$ npm i --save dot
```

· 作用 : 将.dot文件流内容编译成纯HTML内容

#### ArtTemplate-Complie

· 依赖
```sh
$ npm i --save art-template
```

· 作用 : 将.tpl文件流内容编译成纯HTML内容

## Hooks

> 路径钩子

1. Why and What

combo请求的文件资源集合内的文件,有如下几种可能:

(1) 都来自一个本地文件夹内的(可以理解为都来自于于[全局配置](#config-options)中`root`定义的路径下)

(2) 来自不同文件夹内的资源

(3) 来自不同的远程服务器上的资源

(4) 文件有别名

(5) 包含特定处理逻辑的资源名称

针对以上情况,设立一个文件实际路径获取的钩子,这样在组件获取到combo请求并将combo请求内的每个资源执行一次钩子操作从而来得到直接的资源地址

2. How

(1) 通过初始化的时候调用API`hooks()`方法来定义钩子

```js
let kcombo = require('koa-combo-static')

//无远程服务器资源的钩子定义模式
kcombo(/*options*/)
    .prefix('combo_js')
    .hooks('combo_js',{
        //自定义:此路径前缀访问的combo请求对应到的磁盘目录地址
        dir:process.cwd(),
        //自定义:此路径前缀访问的combo请求中可以允许出现的资源文件后缀列表
        allow_ext:['js'],
        /**
            自定义资源实际路径的方法定义
                filename: 文件名称
                ext: 文件后缀(带'.'号)
        */
        realpath:(filename,ext)=>{
         /*return real disk path */
        }
    })

//包含远程服务器资源的钩子定义
kcombo(/*options*/)
    .prefix('combo_js')
    .remoteMap('jq.cn','https://cdn.bootcss.com/jquery/3.2.1/')
    .hooks('combo_js',{
        //自定义:此路径前缀访问的combo请求对应到的磁盘目录地址
        dir:process.cwd(),
        //自定义:此路径前缀访问的combo请求中可以允许出现的资源文件后缀列表
        allow_ext:['js'],
        /**
            自定义资源实际路径的方法定义
                filename: 文件名称
                ext: 文件后缀(带'.'号)
                domain:域名
        */
        realpath:(filename,ext,domain)=>{
            //Note:如果在全局配置中设置了'remoteCache'的话,那么这个时候还应该要返回一个本地缓存的文件地址
            // return [/*real remote path*/,/**/]
            //Note: remoteCache:false的时候
            // return /*real remote path*/ || [/*real remote path*/] ||  [/*real remote path*/,null]
        }
    })
```
