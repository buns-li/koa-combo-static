# koa-combo-static

## Install

```sh
$ npm install --save koa-combo-static
```

## Config Options

 *   `root`:[`String`] 文件资源的本地根级目录
 *   `charset`:[`String`] 文件编码格式 (Default: 'utf-8`)
 *   `gzip`: [`Boolean`] 是否允许启动gzip压缩
 *   `maxAge`: [`Number`]  文件的最大缓存时间(Default: `0`)
 *   `isweak`: [`Boolean`] 是否使用弱ETag (Default:true)
 *   `cacheControl`: 自定义文件的缓存控制内容,会覆盖maxAge的作用
 *   `debug`: [`Boolean`] 是否为调试模式,如果为调试模式则不会执行文件资源的压缩、优化操作(Default:`false`)
 *   `static_prefix`:[`Array`] 静态文件资源的前缀路径 (Default: `['js','css','imgs','fonts','videos']`)
 *   `prefix`: [`Array`] 合并资源请求的前缀 (Default: `combo`)
 *   `tag`: [`String`] combo资源请求的连接标签 (Default: `??`),
 *   `combo_map_path`:[`String`] combo资源请求的映射文件路径
 *   `remote_cache`: [`Boolean`] 是否缓存远程文件至本地 (Default:true)
 *   `remote_map`: [`Object`] 远程路由映射 

```json
    {
        'cdn.js.cn':'127.0.1'
    }
```

 *   `path_map`:[`Object`] combo请求的path与本地路径的匹配

```json
       {
          '/combo/js': {
              'dir':'本地磁盘路径',
              'allow_ext':['js'],
              'cat':'js'
          },
          '/combo/wccss': {
              'dir':'本地磁盘路径',
              'allow_ext':['css','less','sass','styl']
              'cat':'css'
          },
          '/combo/wc': {
              'dir':'本地磁盘路径',
              'allow_ext':['js','tpl','coffee','ts'],
              'realpath':(dir,filename,version,domain)=>['...f1.js','...f2.js'],
              'cat':'css'
           }
      }
```
