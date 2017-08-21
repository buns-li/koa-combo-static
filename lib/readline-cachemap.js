const path = require('path')
const fs = require('fs')
const EventEmitter = require('events').EventEmitter

const mkdirp = require('mkdirp')
const util = require('./util')

let cacheInst

module.exports = class ReadlineSourceMap extends EventEmitter {
    constructor(opts) {
        super()
        opts = opts || {}
        this.sperator = opts.sperator || '|'
        this.filepath = opts.filepath
        this.speratorCode = this.sperator.charCodeAt()
    }

    /**
     * 初始化
     * 
     * @static
     * @param {any} opts 配置项
     * @returns ReadlineSourceMap
     */
    static init(opts) {
        return cacheInst || (cacheInst = new ReadlineSourceMap(opts))
    }

    loadCache() {

        let self = this,
            lineCount = 0,
            seperatorIndex = 0,
            rslt = {},
            _bufs

        return new Promise(async(resolve, reject) => {

            let isExists = await util.fileStatAsync(self.filepath)

            if (!isExists) {

                await new Promise((resolve, reject) => {
                    fs.writeFile(self.filepath, '', err => {
                        console.error(err)
                        err ? resolve(false) : resolve(true)
                    })
                })
            }

            let stream = fs.createReadStream(self.filepath)

            stream.on('data', chunk => {

                if (!chunk.length) return

                _bufs = chunk

                for (let lineStartIndex = 0, i = 0, l = chunk.length; i < l; i++) {

                    if (chunk[i] === self.speratorCode) {

                        seperatorIndex = i - 1

                    } else if (chunk[i] === 10 || chunk[i] === 13) {

                        lineCount += 1

                        let
                            filename = chunk.slice(lineStartIndex, seperatorIndex + 1).toString(),
                            diskpath = chunk.slice(seperatorIndex + 2, i).toString()

                        rslt[filename] = diskpath

                        lineStartIndex = i + 1

                        self.emit('line', filename, diskpath)
                    }
                }
            })

            stream.on('end', () => {

                if (!lineCount && _bufs) {

                    let filename = _bufs.slice(0, seperatorIndex + 1).toString()

                    rslt[filename] = _bufs.slice(seperatorIndex + 2, _bufs.length).toString()
                }

                self.emit('loaded', rslt)

                resolve()
            })

            stream.on('error', err => {
                self.emit('error', err)
                reject(err)
            })
        })
    }

    storeCache(filename, diskpath) {

        let wStream = fs.createWriteStream(this.filepath, {
            flags: 'a'
        })

        wStream.write(filename)
        wStream.write(this.sperator)
        wStream.write(diskpath)
        wStream.write('\n')
        wStream.end()
    }
}
