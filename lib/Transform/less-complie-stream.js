'use strict'

const
    less = require('less'),
    Stream = require('stream')

class LessComplieStream extends Stream.Transform {

    constructor() {
        super()
    }

    _transform(chunk, enc, cb) {
        less.render(chunk.toString(), function(e, output) {
            e ? cb(e) : cb(null, output.css)
        })
    }
}

module.exports = () => new LessComplieStream()