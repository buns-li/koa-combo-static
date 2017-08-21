'use strict'

const

    Stream = require('stream'),
    MiniCSS = require('clean-css')

class CSSMiniStream extends Stream.Transform {

    constructor(options) {
        super(options)
        this.opts = options
    }

    _transform(chunk, enc, cb) {

        new MiniCSS(this.opts).minify(chunk.toString(), (err, output) => {
            err ? cb(err) : cb(null, output.styles)
        })

    }
}

let cache

module.exports = opts => cache || (cache = new CSSMiniStream(opts))
