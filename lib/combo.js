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
            ext,
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

                ext = path.extname(filepath)

                transformEngine = conf.transform[ext]

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

                ext = '.' + regMatches[3]

                rStream = fs.createReadStream(filepath)

                transformEngine = conf.transform[ext]

                if (transformEngine) {
                    rStream = rStream.pipe(transformEngine[2](transformEngine[1]))
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

        let diskpath = path.join(conf.root, util.getCombodFileName(fileStats) + '.' + (cache_combo_file_ext || 'combo'))

        let cacheFileName = waitingComboFilesPath.join(',')

        RDLMap.init().storeCache(cacheFileName, diskpath)

        outputStream.pipe(
            new Stream.PassThrough().pipe(
                fs.createWriteStream(diskpath, {
                    encoding: conf.charset
                })
            )
        )

        ctx.type = MIMES[cache_combo_file_ext || 'unknow']

        if (conf.gzip) {
            ctx.vary('Accept-Encoding')
            ctx.remove('content-length')
            ctx.set('content-encoding', 'gzip')
            outputStream = outputStream.pipe(zlib.createGzip())
        }

        outputStream.on('end', function () {
            self.__cache[cacheFileName] = diskpath
        })

        return outputStream
    }

    getTransform(name) {

        let transforms = this[confSymbol].transform

        let transform = (name === 'minjs' || name === 'mincss' || name === 'minhtml') ? transforms[name] : transforms['.' + name]

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

        let conf = this[confSymbol]

        let curTransforms = conf.transform || (conf.transform = {})

        ext = Array.isArray(ext) ? ext : [ext]

        ext.forEach(item => {

            let curEngine = curTransforms[item]

            if (!curEngine && engineFactory) {
                curTransforms[item] = [engineName, engineOptions, engineFactory]
            } else if (curEngine) {
                //如果是内置的转换引擎,则需要判断engineOptions和engineFactory的可用性
                if (engineFactory && util.isFunction(engineFactory)) {
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
