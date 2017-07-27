//"node-sass": "^4.5.3",
const
    sass = require('node-sass'),
    Stream = require('stream')

class SassComplieStream extends Stream.Transform {

    constructor(opts) {
        super(opts)
        this.opts = opts || {}
    }

    _transform(chunk, enc, cb) {

        if (!chunk || !chunk.length) {
            return cb()
        }

        this.opts.data = chunk.toString()

        sass.render(this.opts, (err, result) => {
            if (err) {
                cb(err)
            } else {
                cb(null, result.css)
            }
        })
    }
}

module.exports = (opts) => new SassComplieStream(opts)