const
    ejs = require('ejs'),

    TransformStream = require('stream').Transform

class Stream extends TransformStream {

    constructor(opts) {
        super(opts)
        this.opts = opts
        this.context = context
    }

    _transform(chunk, enc, cb) {

        if (!chunk.length) return cb()

        try {

            let output = ejs.render(chunk.toString(), this.context, this.opts)

            cb(null, output)

        } catch (ex) {

            cb(ex)

        }

    }

}

let cache

module.exports = (opts, context) => cache || (cache = new Stream(opts, context))
