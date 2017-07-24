'use strict'

const
    path = require('path')

, fs = require('fs')

, crypto = require('crypto')

, Stream = require('stream')

, CombinedStream = require('combined-stream')

, request = require('request')

, MIMES = require('./mime-types')

, allTransformStream = require('./Transform')

, uglifyStream = require('./Transform/uglify-stream')

, cssminiStream = require('./Transform/mini_css-stream')

, mkdirp = require('mkdirp')

let cache_combo_reg //^\/(combo|xcombo)\/?(.*)\?\?(.+)$
    , cache_static_reg //^\/(js|css|fonts|imgs|videos)\/(.+)$

module.exports = class Combo {
    constructor() {}

    static fileStat(filePath) {
        return new Promise((resolve, reject) => {
            fs.stat(filePath, (err, stat) => resolve(err || !stat || !stat.isFile() ? false : stat))
        })
    }

    isCombo(url) {

        // console.log('^\\/(' + this.prefix.join('|').replace(/\//g, '\\/') + ')\\/?(.*)' + this.tag.replace(/\?/g, '\\?') + '(.+)$')
        cache_combo_reg || (cache_combo_reg = new RegExp('^\\/(' + this.prefix.join('|').replace(/\//g, '\\/') + ')\\/?(.*)' + this.tag.replace(/\?/g, '\\?') + '(.+)$'))

        return url ? url.match(cache_combo_reg) : false
    }

    isStatic(url) {

        cache_static_reg || (cache_static_reg = new RegExp('^\\/(' + this.static_prefix.join('|') + ')\\/(.+)'))

        return url ? url.match(cache_static_reg) : false
    }

    async staticStream(fullpath, ctx) {

        let fileStat = await Combo.fileStat(fullpath)

        if (!fileStat) {
            ctx.status = 404
            return false
        }

        let lastModified = fileStat.mtime.toUTCString()

        //判断资源重复
        if (ctx.headers['if-modified-since'] && lastModified === ctx.headers['if-modified-since']) {
            ctx.status = 404
            return false
        }

        let ext = path.extname(fullpath)
        ext = ext ? ext.slice(1) : 'unknown'

        let mtime = fileStat.mtime.getTime().toString(16)
        let size = fileStat.size.toString(16)

        ctx.type = MIMES[ext]
        ctx.lastModified = lastModified
        ctx.length = fileStat.size
        ctx.etag = size + '-' + mtime
        ctx.etag = this.isweak ? ('W/' + ctx.etag) : ctx.etag

        let rStream = fs.createReadStream(fullpath)

        ctx.set('cache-control', this.cacheControl || ('public , max-age=' + this.maxAge))
        ctx.set('expires', new Date(Date.now() + this.maxAge * 1000).toUTCString())

        if (this.gzip) {
            ctx.vary('Accept-Encoding')
            ctx.remove('content-length')
            ctx.set('content-encoding', 'gzip')
            return rStream.pipe(zlib.createGzip())
        }
        return rStream
    }

    async combine(client_path, matchFiles, combomap, isfromComboMap) {

        let map = this.path_map[client_path]

        if (!map) return

        let
            combinedStream = CombinedStream.create()

        //file.stat数组,用于生成etag
        , fileStats = []

        //临时Stream
        , tmpStream
        //文件后缀名
        , ext
        //文件完整路径
        , fullpath
        //单个文件的stat的对象
        , fileStat
        // 可读流
        , rStream

        for (let matchArr, l = matchFiles.length; l--;) {

            matchFiles[l] = path.normalize(matchFiles[l][0] === '/' ? matchFiles.slice(1) : matchFiles[l])

            matchArr = matchFiles[l].match(map.reg)

            if (!matchArr) continue

            matchArr[1] = matchArr[1] && matchArr[1].replace('/', '')

            if (map.realpath) {
                fullpath = map.realpath(map.dir, matchArr[2], '.' + matchArr[3], matchArr[5], matchArr[1])
            } else {
                fullpath = path.join(map.dir, matchArr[2] + '.' + matchArr[3])
            }

            fileStat = await Combo.fileStat(fullpath) //判断本地存不存在

            if (!fileStat) {

                if (matchArr[1]) {
                    await Combo.createRemoteDir(map.dir, matchArr[1])
                }
                if (matchArr[1]) { //判断是否是远程地址请求,同时本地有不存在该远程文件的副本的

                    let real_remote = this.remote_map[matchArr[1]]

                    tmpStream = request(real_remote + matchArr[2] + '.' + matchArr[3]) //远程文件的读取流

                    combinedStream.append(tmpStream)

                    if (this.remote_cache) { //远程文件是否落地本地
                        tmpStream.pipe(
                            new Stream.PassThrough().pipe(
                                fs.createWriteStream(fullpath)
                            )
                        )
                    }

                }
                continue
            }

            fileStats.push(fileStat)

            //判断文件是否需要编译 typescript coffee less sass style
            ext = path.extname(fullpath)

            let tStream = allTransformStream[this.transform[ext]]

            rStream = fs.createReadStream(fullpath)

            if (tStream) {
                rStream = rStream.pipe(tStream())
            }

            combinedStream.append(rStream)
        }

        rStream = combinedStream.pipe(map.cat === 'js' ? uglifyStream({ compress: false, mangle: true }) : cssminiStream())

        let diskfullpath = path.join(map.dir, Combo.getCombodFileNames(matchFiles, fileStats) + '.' + map.cat)

        if (combomap) {

            let continueFlag = true

            if (isfromComboMap) {

                let cacheFileName = this.mapdata[matchFiles.join(',')].diskpath

                cacheFileName = path.basename(cacheFileName)

                let combodFileName = Combo.getCombodFileNames(matchFiles, fileStats) + '.' + map.cat

                if (cacheFileName === combodFileName) { //如果两次操作结果生成的文件唯一标识一样的话,那么就不要填充到映射文件中
                    continueFlag = false
                }
            }
            if (continueFlag) {
                let mapWriteStream = combomap.append(matchFiles.join(','), diskfullpath)
                rStream.pipe(
                    new Stream.PassThrough().pipe(
                        fs.createWriteStream(diskfullpath)
                    ),
                    new Stream.PassThrough().pipe(mapWriteStream)
                )
                return rStream
            }
        }
        rStream.pipe(
            new Stream.PassThrough().pipe(
                fs.createWriteStream(diskfullpath)
            )
        )
        return rStream
    }
    static getCombodFileNames(source_filenames, fileStats) {
        let tag = ''
        let sizes = 0
        let times = []
        fileStats.forEach(stat => {
            if (!stat) return
            times.push(stat.mtime.getTime().toString())
            sizes += stat.size
                // tag += '-' + stat.mtime.getTime().toString(16) + ':' + stat.size.toString(16)
        })
        tag = times.join('_').toString(16) + '__' + sizes.toString(16)
        return tag //crypto.createHash('md5').update(source_filenames.join('')).digest('hex')
    }

    static createRemoteDir(dir, domainName) {
        return new Promise((resolve, reject) => {
            mkdirp(path.join(dir, domainName), function(err) {
                if (err) {
                    console.warn(err)
                    return resolve(false)
                }
                return resolve(true)
            })
        })
    }
}