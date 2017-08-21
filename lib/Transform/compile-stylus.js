'use strict'

const
    stylus = require('stylus'),
    TransformStream = require('stream').Transform

class Stream extends TransformStream {

    constructor(opts) {
        super(opts)
        this.opts = opts
    }

    _transform(chunk, enc, cb) {
        stylus.render(chunk.toString(), this.opts, function (e, css) {
            e ? cb(e) : cb(null, css)
        })
    }
}

let cache

module.exports = opts => cache || (cache = new Stream(opts))
