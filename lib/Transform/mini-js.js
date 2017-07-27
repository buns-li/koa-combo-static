const Stream = require('stream'),
    UglifyJS = require('uglify-js')

class UglifyStream extends Stream.Transform {
    constructor(options) {
        super(options)
        this.opts = options
    }

    _transform(chunk, enc, cb) {
        let result = UglifyJS.minify(chunk.toString(), this.opts)
        cb(null, result.code)
    }
}

module.exports = opts => new UglifyStream(opts)