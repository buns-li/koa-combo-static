'use strict'

//const should = require('should')

require('should')

const comboMiddleware = require('../')

const path = require('path')
const fs = require('fs')

process.on('unhandledRejection', (reason, p) => {
    console.warn('Unhandled Rejection at: Promise ', p, ' reason: ', reason)
})

process.on('uncaught', (reason, p) => {
    console.warn('Uncaught ', p, ' reason: ', reason)
})

function next() {
    console.log('next')
}

const comboFunc = comboMiddleware({
    debug: true,
    mini: false,
    root: path.join(__dirname, './'),
    maxAge: 60 * 60,
    allowTransform: ['less', 'njk_js', 'dot_js', 'art_js', 'pug_js', 'ejs_js', 'hbs_js'],
    remoteMap: {
        'jq.cn': 'https://cdn.bootcss.com/jquery/3.2.1/'
    },
    remoteCache: true,
    cacheMapOption: {
        filepath: path.join(__dirname, './combo_map.txt')
    },
    hooks: {
        'combojs': {
            'dir': path.join(__dirname, './cmps'),
            'allow_ext': ['js', 'njk_js', 'dot_js', 'art_js', 'pug_js', 'ejs_js', 'hbs_js'],
            'on-mini': 'jsmini',
            realpath: (filename, ext, domain, remoteMap) => {

                if (!domain) {

                    let realExt = ''

                    if (['.njk_js', '.dot_js', '.art_js', '.pug_js', '.ejs_js', '.hbs_js'].includes(ext)) {
                        realExt = ext.replace('_js', '')
                    } else {
                        realExt = ext
                    }

                    filename = filename.replace('(', '').replace(')', '')

                    if (~filename.indexOf('|')) {
                        filename = filename.split('|')
                    } else {
                        filename = [filename]
                    }

                    let names = []

                    filename.forEach(name => {
                        names.push(path.join(__dirname, './cmps', name, 'cmp' + realExt))
                    })

                    return names
                }

                return remoteMap[domain.replace('/', '')] + filename + ext
            }
        }
    }
})

describe('combo test', function () {

    let ctx = {
        method: 'GET',
        headers: {},
        set: (val) => console.log(val)
    }

    //检测是否可并成功
    it.skip('should return a {\n    display: inline-block;\n} when uglify test.css', done => {

        ctx.path = '/css/test.css'
        ctx.url = '/css/test.css'

        comboFunc.middleware()(ctx, next).then(() => {

            if (ctx.body) {

                let writeStream = fs.createWriteStream('./temp.css')

                ctx.body.pipe(writeStream)
                    .on('finish', function () {

                        let content = fs.readFileSync('./temp.css').toString()

                        content.should.be.equal('a {\n    display: inline-block;\n}')

                        fs.unlinkSync('./temp.css')

                        done()
                    })
            }
        })
    })

    it.skip('should response combo stream which have remote url request', function (done) {

        ctx.path = '/combojs'
        ctx.url = '/combojs??test1.js,test2.js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })
    })

    it.skip('should response precompile njk_js function string', done => {
        ctx.path = '/combojs'
        ctx.url = '/combojs??test1.js,test2.njk_js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })
    })

    it.skip('should response precompile dot_js function string', done => {
        ctx.path = '/combojs'
        ctx.url = '/combojs??test1.js,test2.dot_js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })
    })

    it.skip('should response precompile art_js function string', done => {
        ctx.path = '/combojs'
        ctx.url = '/combojs??test1.js,test2.art_js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })
    })

    it.skip('should response precompile ejs_js function string', done => {

        ctx.path = '/combojs'

        ctx.url = '/combojs??test1.js,test2.ejs_js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })
    })

    it.skip('should response precompile pug_js function string', done => {

        ctx.path = '/combojs'

        ctx.url = '/combojs??test1.js,test2.pug_js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })
    })

    it.skip('should response precompile hbs_js function string', done => {

        ctx.path = '/combojs'

        ctx.url = '/combojs??test1.js,test2.hbs_js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })
    })

    it.skip('remote file', done => {

        ctx.path = '/combojs'

        ctx.url = '/combojs??jq.cn/core.js,test1.js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })

    })

    it('multiple file', done => {
        ctx.path = '/combojs'

        ctx.url = '/combojs??(test1|test2).njk_js,(test1|test2).js'

        comboFunc.middleware()(ctx, next).then(() => {

            ctx.body && ctx.body.pipe(process.stdout)

            //含有远程下载操作最好保证小于2000ms一下的延迟
            setTimeout(function () {
                done()
            }, 1500)
        })

    })
})
