'use strict'

const
    less = require('less'),
    TransformStream = require('stream').Transform

class Stream extends TransformStream {

    constructor() {
        super()
    }

    _transform(chunk, enc, cb) {
        less.render(chunk.toString(), function (e, output) {
            e ? cb(e) : cb(null, output.css)
        })
    }
}

module.exports = opts => new Stream(opts)
