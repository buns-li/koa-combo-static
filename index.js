const path = require('path')

const util = require('./lib/util')

const RDLMap = require('./lib/readline-cachemap')

const Combo = require('./lib/combo')

const DEFAULT_PRECOMPILE_TPL_NAME_FN = filepath => 'tpl_' + path.basename(path.dirname(filepath))

const defaultOptions = {
    debug: false,
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
    allowTransform: [
        'less',
        'scss',
        'stylus',
        'dot',
        'nunjucks',
        'art-template',
        'ejs',
        'hbs',
        'pug',
        'dot_js',
        'njk_js',
        'art_js',
        'ejs_js',
        'hbs_js',
        'pug_js'
    ],
    precompileTplNameFn: DEFAULT_PRECOMPILE_TPL_NAME_FN
}

let wrp = {}

module.exports = function (options) {

    //矫正一些输入
    options.root && util.isString(options.root) && (options.root = path.normalize(options.root))

    options.prefix && util.isString(options.prefix) && (options.prefix = [options.prefix])

    options.prefixOfStatic && util.isString(options.prefixOfStatic) && (options.prefixOfStatic = [options.prefixOfStatic])

    options.allowTransform && util.isString(options.allowTransform) && (options.allowTransform = [options.allowTransform])

    if (!options.precompileTplNameFn) {
        options.precompileTplNameFn = DEFAULT_PRECOMPILE_TPL_NAME_FN
    }

    options = options ? Object.assign({}, defaultOptions, options) : defaultOptions

    let combo = new Combo(options)

    if (options.mini) {

        combo
            .transform({
                ext: 'minjs',
                name: 'jsmini',
                opts: {
                    compress: false,
                    mangle: true
                },
                factory: require('./lib/Transform/mini-js')
            })
            .transform({
                ext: 'mincss',
                name: 'cssmini',
                opts: {
                    level: {
                        1: {
                            all: true,
                            normalizeUrls: false
                        },
                        2: {
                            restructureRules: true
                        }
                    }
                },
                factory: require('./lib/Transform/mini-css')
            })
            .transform({
                ext: 'minhtml',
                name: 'htmlmini',
                opts: {
                    compress: false,
                    mangle: true
                },
                factory: require('./lib/Transform/mini-html')
            })
    }

    if (options.allowTransform) {

        options.allowTransform.forEach(transform => {
            switch (transform) {
                case 'less':
                    combo.transform({
                        ext: '.less',
                        name: 'less',
                        opts: {},
                        factory: require('./lib/Transform/compile-less')
                    })
                    break
                case 'sass':
                    combo.transform({
                        ext: '.scss',
                        name: 'scss',
                        opts: {},
                        factory: require('./lib/Transform/compile-sass')
                    })
                    break
                case 'stylus':
                    combo.transform({
                        ext: '.styl',
                        name: 'stylus',
                        opts: {},
                        factory: require('./lib/Transform/compile-stylus')
                    })
                    break
                case 'njk_js':
                    /**
                     * `opts` please see <https://mozilla.github.io/nunjucks/api.html#precompile>
                     */
                    combo.transform({
                        ext: '.njk_js',
                        name: 'njk_precompile',
                        opts: {
                            name: options.precompileTplNameFn, //path.basename(filepath, path.extname(filepath)),
                            asFunction: true,
                            force: false
                        },
                        factory: require('./lib/Transform/precompile-nunjucks.js')
                    })
                    break
                case 'dot_js':
                    /**
                     * `opts` please see <http://olado.github.io/doT/>
                     */
                    combo.transform({
                        ext: '.dot_js',
                        name: 'dot_precompile',
                        opts: {
                            evaluate: /\{\{([\s\S]+?(\}?)+)\}\}/g,
                            interpolate: /\{\{=([\s\S]+?)\}\}/g,
                            encode: /\{\{!([\s\S]+?)\}\}/g,
                            use: /\{\{#([\s\S]+?)\}\}/g,
                            useParams: /(^|[^\w$])def(?:\.|\[[\'\"])([\w$\.]+)(?:[\'\"]\])?\s*\:\s*([\w$\.]+|\"[^\"]+\"|\'[^\']+\'|\{[^\}]+\})/g,
                            define: /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
                            defineParams: /^\s*([\w$]+):([\s\S]+)/,
                            conditional: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
                            iterate: /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
                            varname: 'it',
                            strip: true,
                            append: true,
                            selfcontained: false,
                            doNotSkipEncoded: false,
                            name: options.precompileTplNameFn
                        },
                        factory: require('./lib/Transform/precompile-dot')
                    })
                    break
                case 'art_js':
                    /**
                     * `opts` please see <https://aui.github.io/art-template/docs/options.html>
                     */
                    combo.transform({
                        ext: '.art_js',
                        name: 'art_precompile',
                        //详见`ejs`的`options`说明
                        opts: {
                            escape: true,
                            debug: true,
                            compileDebug: false,
                            name: options.precompileTplNameFn
                        },
                        factory: require('./lib/Transform/precompile-art-template')
                    })
                    break
                case 'ejs_js':
                    /**
                     *  @see <https://github.com/mde/ejs#options>
                     */
                    combo.transform({
                        ext: '.ejs_js',
                        name: 'less_precompile',
                        //详见`ejs`的`options`说明
                        opts: {
                            client: true,
                            rmWhitespace: true,
                            strict: true,
                            debug: false,
                            compileDebug: false,
                            name: options.precompileTplNameFn
                        },
                        factory: require('./lib/Transform/precompile-ejs')
                    })
                    break
                case 'jade_js':
                case 'pug_js':
                    combo.transform({
                        ext: ['.pug_js', '.jade_js'],
                        name: 'pug_precompile',
                        opts: {
                            name: options.precompileTplNameFn,
                            debug: false,
                            compileDebug: false,
                            inlineRuntimeFunctions: false
                        },
                        factory: require('./lib/Transform/precompile-pug')
                    })
                    break
                case 'hbs_js':
                    combo.transform({
                        ext: '.hbs_js',
                        name: 'hbs_precompile',
                        opts: {
                            name: options.precompileTplNameFn
                        },
                        factory: require('./lib/Transform/precompile-hbs')
                    })
                    break
                case 'hbs':
                    combo.transform({
                        ext: '.hbs',
                        name: 'hbs',
                        opts: {},
                        factory: require('./lib/Transform/compile-hbs')
                    })
                    break
                case 'dot':
                    /**
                     * `opts` please see <http://olado.github.io/doT/>
                     */
                    combo.transform({
                        ext: '.dit',
                        name: 'dot',
                        opts: {},
                        factory: require('./lib/Transform/compile-dot')
                    })
                    break
                case 'nunjucks':
                    /**
                     * `opts` please see <https://mozilla.github.io/nunjucks/api.html#configure>
                     */
                    combo.transform({
                        ext: '.njk',
                        name: 'nunjucks',
                        opts: {
                            autoescape: true,
                            throwOnUndefined: false,
                            trimBlocks: false,
                            lstripBlocks: false,
                            noCache: false
                        },
                        factory: require('./lib/Transform/compile-nunjucks')
                    })
                    break
                case 'ejs':
                    /**
                     *  @see <https://github.com/mde/ejs#options>
                     */
                    combo.transform({
                        ext: '.ejs',
                        name: 'ejs',
                        opts: {
                            client: true,
                            rmWhitespace: true,
                            strict: true,
                            debug: false,
                            compileDebug: false
                        },
                        factory: require('./lib/Transform/compile-ejs')
                    })
                    break
                case 'art-template':
                    /**
                     * `opts` please see <https://aui.github.io/art-template/docs/options.html>
                     */
                    combo.transform({
                        ext: '.art',
                        name: 'artTemplate',
                        opts: {
                            // 是否开启对模板输出语句自动编码功能。为 false 则关闭编码输出功能
                            // escape 可以防范 XSS 攻击
                            escape: true,
                            // 启动模板引擎调试模式。如果为 true: {cache:false, minimize:false, compileDebug:true}
                            debug: true,
                            // bail 如果为 true，编译错误与运行时错误都会抛出异常
                            bail: true,
                            // 是否开启缓存
                            cache: false,
                            // 是否开启压缩。它会运行 htmlMinifier，将页面 HTML、CSS、CSS 进行压缩输出
                            // 如果模板包含没有闭合的 HTML 标签，请不要打开 minimize，否则可能被 htmlMinifier 修复或过滤
                            minimize: false,
                            // 是否编译调试版
                            compileDebug: false,
                            // 默认后缀名。如果没有后缀名，则会自动添加 extname
                            extname: '.art'
                        },
                        factory: require('./lib/Transform/compile-art-template')
                    })
                    break
                case 'pug':
                    /**
                     * `opts` please see <https://github.com/pugjs/pug#options>
                     */
                    combo.transform({
                        ext: '.pug',
                        name: 'pug',
                        opts: {
                            name: options.precompileTplNameFn
                        },
                        factory: require('./lib/Transform/compile-pug')
                    })
                    break
                default:
                    break
            }
        })
    }

    if (options.hooks) {
        for (let key in options.hooks) {
            combo.hooks(key, options.hooks[key])
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

        let rdlmap

        if (!options.debug) {

            rdlmap = RDLMap.init({
                filepath: path.join(process.cwd(), 'combo_cache.txt')
            })

            rdlmap.on('loaded', data => {
                combo.__cache = data
            })
        }

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

            let waitingComboFilesPath = matchRslt[3].split(',').sort()

            if (!options.debug && !combo.__cache) await rdlmap.loadCache()

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
