'use strict'

const events = require('events')
const path = require('path')
const fs = require('fs')
const zlib = require('zlib')
const request = require('request')
const Stream = require('stream')
const CombinedStream = require('combined-stream')

const util = require('./util')
const MIMES = require('./mime-types')

const RDLMap = require('./readline-cachemap')

/**
 *  Combo(opts)
 *      .static(root,prefix)
 *      .prefix(`Mixed String|Array`)
 *      .tag(`String`)
 *      .charset(`String`)
 *      .mini(`Boolean`)
 *      .gzip(`Boolean`)
 *      .maxAge(`Number`)
 *      .cacheControl(`Mixed String|REST `)
 *      .remoteMap(url,realhost)
 *      .hooks(uripath,dir,allow_ext,cat)
 *      .transform(`Mixed String|Array`)
 *      .sourcemap(`Mixed String|Array`)
 *      .middlewares()
 */

class Combo extends events.EventEmitter {

    constructor(options) {
        super(options)
        this.options = options || {}
    }

    async _streamOfStatic(filepath, ctx) {

        let fileStat = await util.fileStatAsync(filepath)

        if (!fileStat) {
            ctx.status = 404
            return false
        }

        let lastModified = fileStat.mtime.toUTCString()

        //判断资源重复
        if (ctx.headers['if-modified-since'] && lastModified === ctx.headers['if-modified-since']) {
            ctx.status = 304
            return false
        }

        let opts = this.options

        let ext = path.extname(filepath)
        ext = ext ? ext.slice(1) : 'unknown'

        let mtime = fileStat.mtime.getTime().toString(16)
        let size = fileStat.size.toString(16)

        ctx.type = MIMES[ext]
        ctx.lastModified = lastModified
        ctx.length = fileStat.size
        ctx.etag = size + '-' + mtime
        ctx.etag = opts.isweak ? ('W/' + ctx.etag) : ctx.etag

        let rStream = fs.createReadStream(filepath, { encoding: opts.charset })

        ctx.set('cache-control', opts.cacheControl || ('public , max-age=' + opts.maxAge))
        ctx.set('expires', new Date(Date.now() + opts.maxAge * 1000).toUTCString())

        if (opts.gzip) {
            ctx.vary('Accept-Encoding')
            ctx.remove('content-length')
            ctx.set('content-encoding', 'gzip')
            return rStream.pipe(zlib.createGzip())
        }
        return rStream
    }

    async _streamOfCombo(ctx, waitingComboFilesPath) {

        let self = this,
            opts = self.options

        let
            regMatches,
            filepath,
            fileStat,
            fileStats = [],
            combinedStream = CombinedStream.create(),
            remoteStream,
            remoteStreams,
            ext,
            transformEngine,
            rStream,
            outputStream,
            cache_combo_file_ext

        let len = waitingComboFilesPath.length

        let hookItem = opts.hooks[ctx.path.slice(1)]

        if (!hookItem) {

            for (; len--;) {

                waitingComboFilesPath[len] = path.normalize(waitingComboFilesPath[len])

                filepath = path.join(opts.root, waitingComboFilesPath[len])

                fileStat = await util.fileStatAsync(filepath)

                if (!fileStat) {
                    self.emit('warn-miss-file', waitingComboFilesPath[len], filepath)
                    continue
                }

                ext = path.extname(filepath)

                transformEngine = opts.transform[ext]

                rStream = fs.createReadStream(filepath)

                if (transformEngine) {
                    rStream = rStream.pipe(transformEngine[2](transformEngine[1]))
                }
                combinedStream.append(rStream)

                fileStats.push(fileStat)
            }

            outputStream = combinedStream

        } else {

            let remoteUrl = ''

            for (; len--;) {

                waitingComboFilesPath[len] = path.normalize(waitingComboFilesPath[len])

                regMatches = waitingComboFilesPath[len].match(hookItem.filterReg)

                if (!regMatches) continue

                cache_combo_file_ext = util.judgeRealExt(regMatches[3])

                if (regMatches[1]) { //远程地址

                    filepath = hookItem.realpath(regMatches[2], '.' + regMatches[3], regMatches[1], opts.remoteMap)

                    if (!filepath) continue

                    if (util.isArray(filepath)) {
                        remoteUrl = filepath[0]
                        filepath = filepath[1]
                    } else {
                        remoteUrl = filepath
                    }

                    if (!remoteUrl) continue

                    if (filepath) {
                        fileStat = await util.fileStatAsync(filepath)
                        if (!fileStat) {
                            //如果是提供了本地缓存地址,但是没有找到的情况
                            await util.mkdir(path.dirname(filepath))
                        }
                    } else {
                        //自定义创建目录
                        await util.mkdir(path.join(opts.root, regMatches[1]))
                    }

                    remoteStream = request(remoteUrl)

                    combinedStream.append(remoteStream)

                    if (opts.remoteCache) {

                        remoteStream.pipe(
                            new Stream.PassThrough().pipe(
                                fs.createWriteStream(filepath)
                            )
                        )
                    }

                    continue

                } else {
                    filepath = hookItem.realpath(regMatches[2], '.' + regMatches[3])
                    fileStat = await util.fileStatAsync(filepath)
                }

                if (!fileStat) continue

                ext = '.' + regMatches[3]

                rStream = fs.createReadStream(filepath)

                transformEngine = opts.transform[ext]

                if (transformEngine) {
                    rStream = rStream.pipe(transformEngine[2](transformEngine[1]))
                }

                combinedStream.append(rStream)

                fileStats.push(fileStat)
            }

            outputStream = combinedStream

            if (opts.mini) {
                let miniEngine,
                    i = 0,
                    hookEvents = ['before-mini', 'on-mini', 'after-mini']

                while (i <= hookEvents.length) {
                    miniEngine = opts.hooks[path.basename(ctx.path)][hookEvents[i++]]
                    if (miniEngine) {
                        transformEngine = self.getTransform(miniEngine)
                        if (transformEngine) {
                            outputStream = outputStream.pipe(transformEngine[2](transformEngine[1]))
                        }
                    }
                }
            }
        }

        let diskpath = path.join(opts.root, util.getCombodFileName(fileStats) + '.' + (cache_combo_file_ext || 'combo'))

        let cacheFileName = waitingComboFilesPath.join(',')

        RDLMap.init().storeCache(cacheFileName, diskpath)

        outputStream.pipe(
            new Stream.PassThrough().pipe(
                fs.createWriteStream(diskpath, { encoding: opts.charset })
            )
        )

        fileStats.forEach(f => ctx.length += f.size)

        ctx.type = MIMES[cache_combo_file_ext || 'unknow']

        if (opts.gzip) {
            ctx.vary('Accept-Encoding')
            ctx.remove('content-length')
            ctx.set('content-encoding', 'gzip')
            outputStream = outputStream.pipe(zlib.createGzip())
        }

        outputStream.on('end', function() {
            console.log('end')
            self.__cache[cacheFileName] = diskpath
        })

        return outputStream
    }

    /**
     * 作为koa2的中间件
     * 
     * @returns 
     * @memberof Combo
     */
    middlewares() {

        let self = this,
            opts = self.options

        let rdlmap = RDLMap.init({
            filepath: path.join(process.cwd(), 'combo_cache.txt')
        })

        rdlmap.on('loaded', data => {
            self.__cache = data
        })

        return async(ctx, next) => {

            if (ctx.method !== 'HEAD' && ctx.method !== 'GET') return await next()

            if (ctx.fresh) {
                ctx.status = 304
                return
            }

            let client_path = ctx.path

            //判断是否存在
            let matchRslt, rslt, fileStat, fullpath, rStream, lastModified

            if (!(matchRslt = util.isCombo(ctx.url, opts.prefix, opts.tag))) {

                if (!(matchRslt = util.isStatic(ctx.url, opts.prefixOfStatic))) {
                    return await next()
                }

                let rslt = await self._streamOfStatic(path.join(opts.root, matchRslt[1], matchRslt[2]), ctx)

                if (rslt !== false) {
                    ctx.body = rslt
                }
                return
            }

            if (!self.__cache) {
                await rdlmap.loadCache()
            }

            let waitingComboFilesPath = matchRslt[3].split(',').sort()

            if (self.__cache) {

                //如果本地存在此文件,则直接走静态文件输出逻辑

                fullpath = self.__cache[waitingComboFilesPath.join(',')]

                if (fullpath) {

                    let rslt = await self._streamOfStatic(fullpath, ctx)

                    if (rslt !== false) {
                        ctx.body = rslt
                        return
                    }
                }
            }

            ctx.body = await self._streamOfCombo(ctx, waitingComboFilesPath)
        }
    }

    getTransform(name) {

        let transforms = this.options.transform

        let transform = transforms['.' + name]

        if (!transform) {
            for (let p in transforms) {
                if (transforms[p][0] === name) {
                    transform = transforms[p]
                    break
                }
            }
        }

        return transform
    }

    /**
     * 自定义|重置  转换流引擎
     * 
     * @param {any} ext 文件后缀名
     * @param {any} engineName 引擎名称 
     * @param {any} engineOptions 引擎配置选项 (Optional)
     * @param {any} engineFactory 引擎构造函数 (Optional)
     * @returns {Combo} this 当前对象实例
     * @memberof Combo
     */
    transform(ext, engineName, engineOptions, engineFactory) {
        if (!ext || !engineName) return this

        let curTransforms = this.options.transform || (this.options.transform = {})

        ext = Array.isArray(ext) ? ext : [ext]

        ext.forEach(item => {

            let curEngine = curTransforms[item]

            if (!curEngine && engineFactory) {
                curTransforms[item] = [engineName, engineOptions, engineFactory]
            } else if (curEngine) {
                //如果是内置的转换引擎,则需要判断engineOptions和engineFactory的可用性
                if (engineFactory && isFunction(engineFactory)) {
                    curEngine[2] = engineFactory
                }
                engineOptions && (curEngine[1] = engineOptions)
            }
        })

        return this
    }

    /**
     * 解析combo请求的文件列表时的自定义钩子
     *  用于获取每个文件的实际地址
     * 
     * @param {String} comboPrefix combo合并前缀(与`prefix选项对应`)
     * @param {Object} options 此前缀对应的选项
     *  `options.dir`: [`String`] 前缀对应的物理路径
     *  `options.allow_ext`:[`Array`] 此前缀允许访问的文件后缀
     *  `options.realpath`:[`Function`] 实际地址获取的回调方法
     * @returns  {Combo} this 当前对象实例
     * @memberof Combo
     */
    hooks(comboPrefix, options) {

        let opts = this.options

        if (!opts.prefix || !opts.prefix.length) return this

        if (!opts.prefix.includes(comboPrefix)) {
            opts.prefix.push(comboPrefix)
        }

        !this.options.hook && (this.options.hooks = {})

        let hookItem = opts.hooks[comboPrefix] = options || {}

        if (!options.realpath) {
            options.realpath = (filename, ext) => {
                return path.join(options.dir, filename + (ext[0] === '.' ? ext : ('.' + ext)))
            }
        }

        if (options.allow_ext) {
            /**
             * match[1]: domain
             * match[2]: filename
             * match[3]: ext
             * match[4]: file.query --- ?v=1
             * match[5]: version
             */
            hookItem.filterReg = new RegExp('(.+\\/)?(.+)\\.(' + options.allow_ext.join('|') + ')(\\?v=(.+))?')
        }

        return this
    }

    /**
     * 远程路由地址映射
     * 
     * @param {String} url combo资源请求中出现的远程地址
     * @param {String} realhost 实际调用的远程路由地址
     * @returns {Combo} this 当前对象实例
     * @memberof Combo
     */
    remoteMap(url, realhost) {
        if (!url || !realhost) return this
        this.options.remoteMap[url] = realhost
        return this
    }

    /**
     * combo类型的资源请求的路由前缀
     * 
     * @param {String|Array} val 
     * @returns {Combo} this 当前对象实例
     * @memberof Combo
     */
    prefix(val) {

        if (val) {

            let typeStr = util.getTypeStr(val)

            switch (typeStr) {
                case 'String':
                    this.options.prefix.push(typeStr)
                    break
                case 'Array':
                    this.options.prefix = this.options.prefix.concat(val)
                    break
            }
        }

        return this
    }

    /**
     * 静态资源请求的路由前缀
     * 
     * @param {String|Array} val 
     * @returns {Combo} this 当前对象实例
     * @memberof Combo
     */
    prefixOfStatic(val) {

        if (val) {

            let typeStr = util.getTypeStr(val)

            switch (typeStr) {
                case 'String':
                    this.options.prefixOfStatic.push(val)
                    break
                case 'Array':
                    this.options.prefixOfStatic = this.options.prefixOfStatic.concat(val)
                    break
            }
        }

        return this
    }

    /**
     * 设置默认的transform
     * 
     * @param {String|Array} name 
     * @returns {Combo} this 当前对象实例
     * @memberof Combo
     */
    dftTransform(name) {

        if (name) {
            let typeStr = util.getTypeStr(name)

            switch (typeStr) {
                case 'String':
                    this.options.dftTransform.push(name)
                    break
                case 'Array':
                    this.options.dftTransform = this.options.dftTransform.concat(name)
                    break
            }
        }

        return this
    }
}

[
    ['root', 'String'],
    ['tag', 'String'],
    ['charset', 'String'],
    ['mini', 'Boolean'],
    ['gzip', 'Boolean'],
    ['maxAge', 'Number'],
    ['cacheControl', 'String'],
    ['isweak', 'Boolean'],
    ['remoteCache', 'Boolean']
].forEach(it => {

    let prop = it[0],
        typeStr = it[1]

    Combo.prototype[prop] = function(val) {
        if (util.isType(typeStr)(val)) {
            this.options[prop] = val
        }
        return this
    }
})


const defaultOptions = {
    root: process.cwd(),
    prefixOfStatic: ['js', 'css', 'imgs', 'fonts', 'videos'],
    prefix: ['combo_js', 'combo_css', 'combo_tpl'],
    tag: '??',
    charset: 'utf-8',
    maxAge: 0,
    gzip: false,
    isweak: true,
    remoteCache: false,
    mini: true,
    dftTransform: ['less', 'scss', 'stylus', 'dot', 'nunjucks', 'art-template', 'ejs']
}


module.exports = options => {

    //矫正一些输入

    if (options.prefix && isString(options.prefix)) {
        options.prefix = [options.prefix]
    }

    if (options.prefixOfStatic && isString(options.prefixOfStatic)) {
        options.prefixOfStatic = [options.prefixOfStatic]
    }

    if (options.root && isString(options.root)) {
        options.root = path.normalize(options.root)
    }

    if (options.dftTransform && isString(options.dftTransform)) {
        options.dftTransform = [options.dftTransform]
    }

    options = options ? Object.assign({}, defaultOptions, options) : Object.assign({}, defaultOptions)

    let combo = new Combo(options)

    if (options.mini) {
        combo
            .transform('minjs', 'jsmini', { compress: false, mangle: true }, require('./Transform/mini-js'))
            .transform('mincss', 'cssmini', {
                level: {
                    1: {
                        all: true,
                        normalizeUrls: false
                    },
                    2: {
                        restructureRules: true
                    }
                }
            }, require('./Transform/mini-css'))
            .transform('minhtml', 'htmlmini', { compress: false, mangle: true }, require('./Transform/mini-html'))
    }

    if (options.dftTransform) {
        options.dftTransform.forEach(transform => {
            switch (transform) {
                case 'less':
                    combo.transform('.less', 'less', null, require('./Transform/complie-less'))
                    break
                case 'sass':
                    combo.transform('.scss', 'scss', null, require('./Transform/complie-sass'))
                    break
                case 'stylus':
                    combo.transform('.styl', 'stylus', null, require('./Transform/complie-stylus'))
                    break
                case 'dot':
                    combo.transform('.dot', 'dot', null, require('./Transform/complie-dot'))
                    break
                case 'nunjucks':
                    combo.transform('.njk', 'nunjucks', {
                        autoescape: true,
                        throwOnUndefined: false,
                        trimBlocks: false,
                        lstripBlocks: false,
                        noCache: false
                    }, require('./Transform/complie-nunjucks'))
                    break
                case 'ejs':
                    combo.transform('.ejs', 'ejs', null, require('./Transform/complie-ejs'))
                    break
                case 'art-template':
                    combo.transform('.art', 'artTemplate', {
                        // 是否开启对模板输出语句自动编码功能。为 false 则关闭编码输出功能
                        // escape 可以防范 XSS 攻击
                        escape: true,
                        // 启动模板引擎调试模式。如果为 true: {cache:false, minimize:false, compileDebug:true}
                        debug: true,
                        // bail 如果为 true，编译错误与运行时错误都会抛出异常
                        bail: true,
                        // 是否开启缓存
                        cache: true,
                        // 是否开启压缩。它会运行 htmlMinifier，将页面 HTML、CSS、CSS 进行压缩输出
                        // 如果模板包含没有闭合的 HTML 标签，请不要打开 minimize，否则可能被 htmlMinifier 修复或过滤
                        minimize: true,
                        // 是否编译调试版
                        compileDebug: false,
                        // 默认后缀名。如果没有后缀名，则会自动添加 extname
                        extname: '.art'
                    }, require('./Transform/complie-art-template'))
                    break

            }
        })
    }

    return combo
}