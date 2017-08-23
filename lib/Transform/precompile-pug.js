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

            let opts = this.opts,
                nameFn

            if (this.curFilePath) {
                if (opts.name && util.isFunction(opts.name)) {
                    nameFn = opts.name
                    opts.name = nameFn(this.curFilePath)
                }
            }

            this.push(pug.compileClient(chunk.toString(), opts))

            nameFn && (opts.name = nameFn)

            cb()

        } catch (ex) {
            cb(ex)
        }
    }
}

module.exports = opts => new Stream(opts)
