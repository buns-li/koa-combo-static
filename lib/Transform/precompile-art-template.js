/**
 * 模板的预编译
 */
const
    artTemplate = require('art-template'),
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

            let renderFnString = artTemplate.compile(chunk.toString(), opts).toString()

            if (this.curFilePath) {
                if (opts.name) {
                    templateName = util.isFunction(opts.name) ? opts.name(this.curFilePath) : opts.name
                }

                renderFnString = `(function(win){win.${templateName}=${renderFnString}}(window))`
            }

            cb(null, renderFnString)

        } catch (ex) {

            cb(ex)

        }

    }
}

module.exports = opts => new Stream(opts)
