'use strict'

const
    stylus = require('stylus')

, Stream = require('stream')

class StylusComplieStream extends Stream.Transform {

    constructor(opts) {
        super(opts)
        this.opts = opts
    }

    _transform(chunk, enc, cb) {
        stylus.render(chunk.toString(), this.opts, function(e, css) {
            e ? cb(e) : cb(null, css)
        })
    }
}

module.exports = opts => new StylusComplieStream(opts)