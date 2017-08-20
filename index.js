const path = require('path')

const util = require('./lib/util')

const RDLMap = require('./lib/readline-cachemap')

const Combo = require('./lib/combo')

const defaultOptions = {
    root: process.cwd(),
    prefixOfStatic: ['js', 'css', 'imgs', 'fonts', 'videos'],
    prefix: ['combo_js', 'combo_css', 'combo_tpl'],
    tag: '??',
    charset: 'utf-8',
    maxAge: 0,
    gzip: false,
    isweak: true,
    remoteCache: false,
    mini: true,
    dftTransform: ['less', 'scss', 'stylus', 'dot', 'nunjucks', 'art-template', 'ejs']
}

let wrp = {}

module.exports = function (options) {

    //矫正一些输入
    options.root && util.isString(options.root) && (options.root = path.normalize(options.root))

    options.prefix && util.isString(options.prefix) && (options.prefix = [options.prefix])

    options.prefixOfStatic && util.isString(options.prefixOfStatic) && (options.prefixOfStatic = [options.prefixOfStatic])

    options.dftTransform && util.isString(options.dftTransform) && (options.dftTransform = [options.dftTransform])

    options = options ? Object.assign({}, defaultOptions, options) : defaultOptions

    let combo = new Combo(options)

    if (options.mini) {
        combo
            .transform('minjs', 'jsmini', {
                compress: false,
                mangle: true
            }, require('./lib/Transform/mini-js'))
            .transform('mincss', 'cssmini', {
                level: {
                    1: {
                        all: true,
                        normalizeUrls: false
                    },
                    2: {
                        restructureRules: true
                    }
                }
            }, require('./lib/Transform/mini-css'))
            .transform('minhtml', 'htmlmini', {
                compress: false,
                mangle: true
            }, require('./lib/Transform/mini-html'))
    }

    if (options.dftTransform) {
        options.dftTransform.forEach(transform => {
            switch (transform) {
                case 'less':
                    combo.transform('.less', 'less', null, require('./lib/Transform/complie-less'))
                    break
                case 'sass':
                    combo.transform('.scss', 'scss', null, require('./lib/Transform/complie-sass'))
                    break
                case 'stylus':
                    combo.transform('.styl', 'stylus', null, require('./lib/Transform/complie-stylus'))
                    break
                case 'dot':
                    combo.transform('.dot', 'dot', null, require('./lib/Transform/complie-dot'))
                    break
                case 'nunjucks':
                    combo.transform('.njk', 'nunjucks', {
                        autoescape: true,
                        throwOnUndefined: false,
                        trimBlocks: false,
                        lstripBlocks: false,
                        noCache: false
                    }, require('./lib/Transform/complie-nunjucks'))
                    break
                case 'ejs':
                    combo.transform('.ejs', 'ejs', null, require('./lib/Transform/complie-ejs'))
                    break
                case 'art-template':
                    combo.transform('.art', 'artTemplate', {
                        // 是否开启对模板输出语句自动编码功能。为 false 则关闭编码输出功能
                        // escape 可以防范 XSS 攻击
                        escape: true,
                        // 启动模板引擎调试模式。如果为 true: {cache:false, minimize:false, compileDebug:true}
                        debug: true,
                        // bail 如果为 true，编译错误与运行时错误都会抛出异常
                        bail: true,
                        // 是否开启缓存
                        cache: true,
                        // 是否开启压缩。它会运行 htmlMinifier，将页面 HTML、CSS、CSS 进行压缩输出
                        // 如果模板包含没有闭合的 HTML 标签，请不要打开 minimize，否则可能被 htmlMinifier 修复或过滤
                        minimize: true,
                        // 是否编译调试版
                        compileDebug: false,
                        // 默认后缀名。如果没有后缀名，则会自动添加 extname
                        extname: '.art'
                    }, require('./lib/Transform/complie-art-template'))
                    break
                default:
                    break

            }
        })
    }

    if (options.hooks) {
        for (let key in options.hooks) {
            combo.hooks(options.prefix, options.hooks[key])
        }
    }

    wrp.transform = (...args) => {
        combo.transform(...args)
        return wrp
    }

    wrp.hooks = (...args) => {
        combo.hooks(...args)
        return wrp
    }

    wrp.middleware = function () {

        let rdlmap = RDLMap.init({
            filepath: path.join(process.cwd(), 'combo_cache.txt')
        })

        rdlmap.on('loaded', data => {
            combo.__cache = data
        })

        return async(ctx, next) => {

            if (ctx.method !== 'HEAD' && ctx.method !== 'GET') return await next()

            if (ctx.fresh) {
                ctx.status = 304
                return
            }

            //判断是否存在
            let matchRslt, fullpath

            if (!(matchRslt = util.isCombo(ctx.url, options.prefix, options.tag))) {

                if ((matchRslt = util.isStatic(ctx.url, options.prefixOfStatic))) {

                    let rslt = await combo._streamOfStatic(path.join(options.root, matchRslt[1], matchRslt[2]), ctx)

                    if (rslt !== false) {
                        ctx.body = rslt
                        return
                    }
                }

                return next()
            }

            if (!combo.__cache) await rdlmap.loadCache()

            let waitingComboFilesPath = matchRslt[3].split(',').sort()

            if (combo.__cache) {

                //如果本地存在此文件,则直接走静态文件输出逻辑

                fullpath = combo.__cache[waitingComboFilesPath.join(',')]

                if (fullpath) {

                    let rslt = await combo._streamOfStatic(fullpath, ctx)

                    if (rslt !== false) {
                        ctx.body = rslt
                        return
                    }
                }
            }

            ctx.body = await combo._streamOfCombo(ctx, waitingComboFilesPath)
        }
    }

    return wrp
}
