/**
 * 模板的预编译
 */
const
    dot = require('dot'),
    TransformStream = require('stream').Transform,
    util = require('../util')

class Stream extends TransformStream {
    constructor(opts) {
        super(opts)
        this.opts = opts || {}
    }

    _transform(chunk, enc, cb) {

        if (!chunk.length) return cb()

        try {

            let opts = this.opts,
                templateName = ''

            let renderFnString = dot.template(chunk.toString(), this.opts).toString()

            if (this.curFilePath) {
                if (opts.name && util.isFunction(opts.name)) {
                    templateName = opts.name(this.curFilePath)
                }
                renderFnString = `(function(win){win.${templateName} = ${renderFnString}}(window));`
            }

            cb(null, renderFnString)

        } catch (ex) {

            cb(ex)

        }

    }
}

let cache

module.exports = opts => cache || (cache = new Stream(opts))
