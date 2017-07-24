'use strict'
const
    path = require('path')

, fs = require('fs')

, Stream = require('stream')

, zlib = require('zlib')

, Combo = require('./lib/combo')

, ReadlineSourcemap = require('./lib/Sourcemap/readline')

, MIMES = require('./lib/mime-types')

, dftOpts = {
    charset: 'utf-8',
    gzip: false,
    maxAge: 0,
    debug: false,
    isweak: true,
    remote_cache: true,
    prefix: ['combo'],
    tag: '??',
    static_prefix: ['js', 'css', 'imgs', 'fonts', 'videos'],
    transform: {
        '.ts': 'typescript',
        '.coffee': 'coffee',
        '.less': 'less',
        '.scss': 'scss',
        '.styl': 'stylus',
        '.njk': 'nunjucks',
        '.jade': 'jade',
        '.ejs': 'ejs',
        '.dot': 'dot',
        '.tpl': 'artTemplate'
    }
}

/**
 * options:
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
 *   `remote_cache`: [`Boolean`] 是否缓存远程文件至本地
 *   `remote_map`: [`Object`] 远程路由映射 
 *      {
 *          'cdn.js.cn':'127.0.1'
 *      },
 *   `path_map`:[`Object`] combo请求的path与本地路径的匹配
 *      {
 *          '/combo/js': {
 *              'dir':'本地磁盘路径',
 *              'allow_ext':['js'],
 *              'cat':'js'
 *          },
 *          '/combo/wccss': {
 *              'dir':'本地磁盘路径',
 *              'allow_ext':['css','less','sass','styl']
 *              'cat':'css'
 *          },
 *          '/combo/wc': {
 *              'dir':'本地磁盘路径',
 *              'allow_ext':['js','tpl','coffee','ts'],
 *              'realpath':(dir,filename,version,domain)=>['...f1.js','...f2.js'],
 *              'cat':'css'
 *          }
 *      }
 */
module.exports = function(options) {

    // options.combo_map = options.combo_map ? require(options.combo_map) : {}

    let combo = new Combo()

    options ? Object.assign(combo, dftOpts, options) : Object.assign(combo, dftOpts)

    let rdlmap

    if (options.combo_map_path) {

        rdlmap = new ReadlineSourcemap({
            map_path: options.combo_map_path
        })

        rdlmap.on('loaded', data => {
            combo.mapdata = data
        })
    }
    return async(ctx, next) => {

        if (ctx.method !== 'HEAD' && ctx.method !== 'GET') return await next()

        let client_path = ctx.path

        //判断是否存在
        let matchRslt, rslt, fileStat, fullpath, rStream, lastModified

        if (!(matchRslt = combo.isCombo(ctx.url))) {

            if (!(matchRslt = combo.isStatic(ctx.url))) {
                return await next()
            }

            if (ctx.fresh) {
                ctx.status = 304
                return
            }

            fullpath = path.join(combo.root, matchRslt[1], matchRslt[2])

            let rslt = await combo.staticStream(fullpath, ctx)

            if (rslt !== false) {
                ctx.body = rslt
            }
            return
        }

        if (ctx.fresh) {
            ctx.status = 304
            return
        }

        if (rdlmap) {
            await rdlmap.load()
        }

        let matchFiles = matchRslt[3].split(',').sort()
        let isfromComboMap = false
        if (combo.mapdata) {

            //如果本地存在此文件,则直接走静态文件输出逻辑

            fullpath = combo.mapdata[matchFiles.join(',')]

            if (fullpath) fullpath = fullpath.diskpath

            if (fullpath) {

                let rslt = await combo.staticStream(fullpath, ctx)

                if (rslt !== false) {
                    ctx.body = rslt
                    return
                } else {
                    isfromComboMap = true
                }
            }
        }

        let map = combo.path_map[ctx.path]

        if (!map.reg) {
            /**
             * match[1]: domain
             * match[2]: filename
             * match[3]: ext
             * match[4]: file.query --- ?v=1
             * match[5]: version
             */
            map.reg = new RegExp('(.+\\/)?(.+)\\.(' + map.allow_ext.join('|') + ')(\\?v=(.+))?')
        }

        ctx.body = await combo.combine(ctx.path, matchFiles, rdlmap, isfromComboMap)

    }
}