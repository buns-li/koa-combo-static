const
    pug = require('pug'),
    TransformStream = require('stream').Transform

class Stream extends TransformStream {
    constructor(opts, context) {
        super(opts)
        this.opts = opts
        this.context = context || {}
    }

    _transform(chunk, enc, cb) {

        if (!chunk.length) return cb()

        pug.render(chunk.toString(), this.context, (err, res) => {
            return err ? cb(err) : cb(null, res)
        })
    }
}

module.exports = (opts, context) => new Stream(opts, context)
