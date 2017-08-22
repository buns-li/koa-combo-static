const
    htmlMinifier = require('html-minifier'),
    TransformStream = require('stream').Transform

class Stream extends TransformStream {

    constructor(opts) {
        super(opts)
        this.opts = opts || {}
    }

    _transform(chunk, enc, cb) {

        if (!chunk.length) return cb()

        let output = htmlMinifier.minify(chunk.toString(), this.opts)

        cb(null, output)
    }
}

module.exports = opts => new Stream(opts)
