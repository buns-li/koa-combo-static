/**
 * 模板的预编译
 */
const
    Handlebars = require('handlebars'),
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

            let opts = this.opts

            let defaultCompiler = function (contents, options) {
                let ast = Handlebars.parse(contents)
                // Preprocess AST before compiling
                if (opts.processAST) {
                    // processAST may return new AST or change it in place
                    ast = opts.processAST(ast) || ast
                }
                return Handlebars.precompile(ast, options).toString()
            }

            let renderFnString = defaultCompiler(chunk.toString(), opts),
                templateName = ''

            if (this.curFilePath) {
                if (opts.name) {
                    templateName = util.isFunction(opts.name) ? opts.name(this.curFilePath) : opts.name
                }
                renderFnString = `(function(win){win.${templateName}=Handelbars.template(${renderFnString})}(window))`
            }

            cb(null, renderFnString)
        } catch (ex) {
            cb(ex)
        }
    }
}

module.exports = opts => new Stream(opts)
