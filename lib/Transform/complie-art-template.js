const
    template = require('art-template'),
    TransformStream = require('stream').Transform

class Stream extends TransformStream {

    constructor(opts) {
        super(opts)
        this.opts = opts
    }

    _transform(chunk, enc, cb) {
        if (!chunk.length) return cb()

        try {

            let context = 'context' in this.opts ? this.opts.context : null

            let output = template.render(chunk.toString(), context, this.opts)

            cb(null, output) // or this.push(output);cb()

        } catch (ex) {
            cb(ex)
        }
    }
}

module.exports = opts => new Stream(opts)