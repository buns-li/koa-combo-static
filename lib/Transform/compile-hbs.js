const
    Handlebars = require('handlebars'),
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

            let template = Handlebars.compile(chunk.toString(), this.opts)

            cb(null, template(this.context))

        } catch (ex) {
            cb(ex)
        }
    }
}

let cache

module.exports = (opts, context) => cache || (cache = new Stream(opts, context))
