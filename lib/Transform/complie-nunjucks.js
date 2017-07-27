const
    nunjucks = require('nunjucks'),
    TransformStream = require('stream').Transform

class Stream extends TransformStream {
    constructor(context) {
        super(context)
        this.context = context
    }

    _transform(chunk, enc, cb) {
        if (!chunk.length) return cb()
        nunjucks.renderString(chunk.toString(), this.context, (err, res) => {
            return err ? cb(err) : cb(null, res)
        })
    }
}

module.exports = opts => {
    if (opts) {
        nunjucks.configure(opts)
    }
    return new Stream(opts.context)
}