const dot = require('dot/dot'),
    TransformStream = require('stream').Transform

class Stream extends TransformStream {
    constructor(opts, context) {
        super(opts)
        this.opts = opts
        this.context = context || {}
    }

    _transform(chunk, enc, cb) {

        if (!chunk.length) return cb()

        try {

            let output = dot.template(chunk.toString(), this.opts)(this.context)

            cb(null, output)

        } catch (ex) {

            cb(ex)

        }
    }
}

module.exports = (opts, context) => new Stream(opts, context)
