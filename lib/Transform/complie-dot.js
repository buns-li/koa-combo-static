const dot = require('dot/dot'),
    TransformStream = require('stream').Transform

class Stream extends TransformStream {
    constructor(opts) {
        super(opts)
        this.opts = opts || {}
    }

    _transform(chunk, enc, cb) {

        if (!chunk.length) return cb()

        try {

            let context = 'context' in this.opts ? this.opts.context : null

            let output = dot.template(chunk.toString(), this.opts)(context)

            cb(null, output)

        } catch (ex) {

            cb(ex)

        }
    }
}

module.exports = opts => new Stream(opts)
