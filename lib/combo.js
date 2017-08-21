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

const confSymbol = Symbol('combo#conf')

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

module.exports = class Combo extends events.EventEmitter {

    constructor(options) {
        super(options)
        // this.options = options || {}
        this[confSymbol] = options || {}
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

        let conf = this[confSymbol]

        let ext = path.extname(filepath)
        ext = ext ? ext.slice(1) : 'unknown'

        let mtime = fileStat.mtime.getTime().toString(16)
        let size = fileStat.size.toString(16)

        ctx.type = MIMES[ext]
        ctx.lastModified = lastModified
        ctx.length = fileStat.size
        ctx.etag = size + '-' + mtime
        ctx.etag = conf.isweak ? ('W/' + ctx.etag) : ctx.etag

        let rStream = fs.createReadStream(filepath, {
            encoding: conf.charset
        })

        ctx.set('cache-control', conf.cacheControl || ('public , max-age=' + conf.maxAge))
        ctx.set('expires', new Date(Date.now() + conf.maxAge * 1000).toUTCString())

        if (conf.gzip) {
            ctx.vary('Accept-Encoding')
            ctx.remove('content-length')
            ctx.set('content-encoding', 'gzip')
            return rStream.pipe(zlib.createGzip())
        }
        return rStream
    }

    async _streamOfCombo(ctx, waitingComboFilesPath) {

        let self = this,
            conf = self[confSymbol]

        let
            regMatches,
            filepath,
            fileStat,
            fileStats = [],
            combinedStream = CombinedStream.create(),
            remoteStream,
            transformEngine,
            rStream,
            outputStream,
            cache_combo_file_ext

        let len = waitingComboFilesPath.length

        let hookItem = conf.hooks[ctx.path.slice(1)]

        if (!hookItem) {

            for (; len--;) {

                waitingComboFilesPath[len] = path.normalize(waitingComboFilesPath[len])

                filepath = path.join(conf.root, waitingComboFilesPath[len])

                fileStat = await util.fileStatAsync(filepath)

                if (!fileStat) {
                    self.emit('warn-miss-file', waitingComboFilesPath[len], filepath)
                    continue
                }

                rStream = fs.createReadStream(filepath)

                transformEngine = self.getTransform(path.extname(filepath).substring(1))

                if (transformEngine) {
                    rStream = rStream.pipe(transformEngine.factory(transformEngine.opts, transformEngine.context))
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

                    filepath = hookItem.realpath(regMatches[2], '.' + regMatches[3], regMatches[1], conf.remoteMap)

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
                        await util.mkdir(path.join(conf.root, regMatches[1]))
                    }

                    remoteStream = request(remoteUrl)

                    combinedStream.append(remoteStream)

                    if (conf.remoteCache) {

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

                rStream = fs.createReadStream(filepath)

                transformEngine = self.getTransform(regMatches[3])

                if (transformEngine) {

                    transformEngine = transformEngine.factory(transformEngine.opts, transformEngine.context)

                    transformEngine.curFilePath = filepath

                    rStream = rStream.pipe(transformEngine)
                }

                combinedStream.append(rStream)

                fileStats.push(fileStat)
            }

            outputStream = combinedStream

            if (conf.mini) {
                let miniEngine,
                    i = 0,
                    hookEvents = ['before-mini', 'on-mini', 'after-mini']

                while (i <= hookEvents.length) {
                    miniEngine = conf.hooks[path.basename(ctx.path)][hookEvents[i++]]
                    if (miniEngine) {
                        transformEngine = self.getTransform(miniEngine)
                        if (transformEngine) {
                            outputStream = outputStream.pipe(transformEngine[2](transformEngine[1]))
                        }
                    }
                }
            }
        }

        if (!conf.debug) {

            let diskpath = path.join(hookItem ? (hookItem.dir || conf.root) : conf.root, util.getCombodFileName(fileStats) + '.' + (cache_combo_file_ext || 'combo'))

            let cacheFileName = waitingComboFilesPath.join(',')

            RDLMap.init().storeCache(cacheFileName, diskpath)

            outputStream.pipe(
                new Stream.PassThrough().pipe(
                    fs.createWriteStream(diskpath, {
                        encoding: conf.charset
                    })
                )
            )

            outputStream.on('end', function () {
                self.__cache[cacheFileName] = diskpath
            })
        }

        ctx.type = MIMES[cache_combo_file_ext || 'unknow']

        if (conf.gzip) {
            ctx.vary('Accept-Encoding')
            ctx.remove('content-length')
            ctx.set('content-encoding', 'gzip')
            outputStream = outputStream.pipe(zlib.createGzip())
        }

        return outputStream
    }

    /**
     * 获取指定后缀名的转换刘引擎
     *
     * @param {any} ext 文件后缀名(不含.)
     * @returns {Hash} 转换流引擎
     */
    getTransform(ext) {

        let transforms = this[confSymbol].transform

        let transform = (ext === 'minjs' || ext === 'mincss' || ext === 'minhtml') ? transforms[ext] : transforms['.' + ext]

        return transform
    }

    /**
     * 自定义|重置  转换流引擎
     *
     * @param {any} options 配置项
     *
     *  * `name`: [`String`] 转换流的名称
     *  * `ext`:  [`String` | `Array`] 转换流支持的文件后缀名称
     *  * `opts`: [`Hash`] 转换流引擎需要的初始化配置项
     *  * `context`: [`Hash`] 转换流引擎运作需要的上下文数据
     *  * `factory`: [`Function`] 转换流引擎的构造工厂
     *
     * @returns {Combo} 当前方法所属作用域(链式调用)
     */
    transform(options) {

        if (!options || !options.ext || !options.name) return this

        let conf = this[confSymbol]

        let curTransforms = conf.transform || (conf.transform = {})

        let ext = Array.isArray(options.ext) ? options.ext : [options.ext]

        ext.forEach(item => {

            let curEngine = curTransforms[item]

            if (!curEngine) { //重新定义一个转换流
                //判断合法性
                if (options.factory && util.isFunction(options.factory)) {
                    curTransforms[item] = options
                }
                //[engineName, engineOptions, engineFactory]
            } else if (curEngine) {

                //如果是内置的转换引擎,则需要判断engineOptions和engineFactory的可用性
                if (options.factory && util.isFunction(options.factory)) {
                    curEngine.factory = options.factory
                }

                options.opts && (curEngine.opts = Object.assign({}, curEngine.opts, options.opts))

                options.context && (curEngine.context = options.context)
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

        let conf = this[confSymbol]

        if (!conf.prefix || !conf.prefix.length) return this

        if (!conf.prefix.includes(comboPrefix)) {
            conf.prefix.push(comboPrefix)
        }

        !conf.hooks && (conf.hooks = {})

        let hookItem = conf.hooks[comboPrefix] = options || {}

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
}
