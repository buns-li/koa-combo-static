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
        nunjucks.renderString(chunk.toString(), this.context, (err, res) => err ? cb(err) : cb(null, res))
    }
}

let cache

module.exports = (opts, context) => {

    if (cache) return cache

    if (opts) {
        nunjucks.configure(opts)
    }

    return (cache = new Stream(context))
}
