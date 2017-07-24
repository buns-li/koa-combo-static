const
    fs = require('fs'),
    smap = require('./')

module.exports = class ReadlineSourceMap extends smap {
    constructor(opts) {
        super()
        opts = opts || {}
        this.sperator = opts.sperator || '|'
        this.mapPath = opts.map_path
        this.speratorCode = this.sperator.charCodeAt()
    }

    load() {

        let self = this

        let lineCount = 0,
            speratorIdxArr = [],
            _bufs, rslt = {}

        return new Promise((resolve, reject) => {

            let stream = fs.createReadStream(this.mapPath)

            stream.on('data', chunk => {

                if (!chunk.length) return

                _bufs = chunk

                for (let i = 0, l = chunk.length; i < l; i++) {

                    if (chunk[i] === self.speratorCode) {

                        speratorIdxArr.push(i - 1)

                    } else if (chunk[i] === 10 || chunk[i] === 13) {

                        lineCount += 1

                        let
                            filename = chunk.slice(0, speratorIdxArr[0] + 1).toString(),
                            diskpath = chunk.slice(speratorIdxArr[0] + 2, i).toString()

                        rslt[filename] = {
                            diskpath: diskpath
                        }

                        speratorIdxArr = []

                        self.emit('line', filename, diskpath)
                    }
                }
            })

            stream.on('end', () => {

                if (!lineCount && _bufs) {

                    let filename = _bufs.slice(0, speratorIdxArr[0] + 1).toString()

                    rslt[filename] = {
                        diskpath: _bufs.slice(speratorIdxArr[0] + 2, _bufs.length).toString()
                    }
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

    append(filenames, diskpath) {

        let wStream = fs.createWriteStream(this.mapPath, { flags: 'a' })

        wStream.write(filenames)
        wStream.write(this.sperator)
        wStream.write(diskpath)
        wStream.write('\n')

        return wStream
    }
}