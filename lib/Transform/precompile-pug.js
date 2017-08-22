const
    pug = require('pug'),
    TransformStream = require('stream').Transform,
    util = require('../util')

class Stream extends TransformStream {
    constructor(opts) {
        super(opts)
        this.opts = opts || {}
    }

    _transform(chunk, enc, cb) {

        if (!chunk.length) return cb()

        try {

            let opts = this.opts

            if (this.curFilePath) {
                if (opts.name) {
                    if (util.isFunction(opts.name)) {
                        opts.name = opts.name(this.curFilePath)
                    }
                }
            }

            cb(null, pug.compileClient(chunk.toString(), opts))

        } catch (ex) {
            cb(ex)
        }
    }
}

module.exports = opts => new Stream(opts)
