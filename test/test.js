'use strict'

//const should = require('should')

const combo = require('../')

const path = require('path')

const Should = require('should')

process.on('unhandledRejection', (reason, p) => {
    console.warn('Unhandled Rejection at: Promise ', p, ' reason: ', reason)
})


process.on('uncaught', (reason, p) => {
    console.warn('Uncaught ', p, ' reason: ', reason)
})

function next() {
    console.log('next')
}

const comboInst = combo({
    remoteMap: {
        'jq.cn': 'https://cdn.bootcss.com/jquery/3.2.1/'
    },
    cacheMapOption: {
        filepath: path.join(__dirname, './combo_map.txt')
    }
})

describe('combo test', function() {

    it.skip('should return default value which have default value option when invokve combo(null|undefined|no default value options given) ', function() {
        Should(comboInst.options.root).be.equal(process.cwd())

        Should(comboInst.options.maxAge).be.equal(0)

        Should(comboInst.options.gzip).be.equal(false)

        Should(comboInst.options.isweak).be.equal(true)

        Should(comboInst.options.remoteCache).be.equal(false)

        Should(comboInst.options.charset).be.equal('utf-8')

        Should(comboInst.options.tag).be.equal('??')

        Should(comboInst.options.prefix).containDeepOrdered(['combo_js', 'combo_css', 'combo_tpl', 'combo_img'])

        Should(comboInst.options.prefixOfStatic).containDeepOrdered(['js', 'css', 'imgs', 'fonts', 'videos'])

        Should(comboInst.options.dftTransform).containDeepOrdered(['less', 'scss', 'stylus', 'dot', 'nunjucks', 'art-template', 'ejs'])
    })

    it.skip('should response static file stream', function(done) {

        let ctx = {
            method: 'GET',
            headers: {},
            set: (val) => console.log(val)
        }

        // ctx.path = '/js/test.js'
        // ctx.url = '/js/test.js'

        ctx.path = '/css/test.css'
        ctx.url = '/css/test.css'

        comboInst
            .root(path.join(__dirname, './'))
            .maxAge(60 * 60)

        comboInst.middlewares()(ctx, next)
            .then(() => {

                ctx.body && ctx.body.pipe(process.stdout)

                done()
            })
    })

    it.skip('should response combo stream', function(done) {
        let ctx = {
            method: 'GET',
            headers: {},
            set: (val) => console.log(val)
        }

        ctx.path = '/combojs'
        ctx.url = '/combojs??test1.js,test2.js'

        comboInst
            .root(path.join(__dirname, './'))
            .maxAge(60 * 60)
            .dftTransform(['less'])
            .hooks('combojs', {
                dir: path.join(__dirname, './cmps'),
                allow_ext: ['js'],
                'on-mini': 'jsmini',
                realpath: (filename, ext) => {
                    return path.join(__dirname, './cmps', filename, 'cmp.js')
                }
            })

        comboInst
            .middlewares()(ctx, next)
            .then(() => {
                done()
            })

    })

    it('should response combo stream which have remote url request', function(done) {
        let ctx = {
            method: 'GET',
            headers: {},
            set: (val) => console.log(val)
        }

        ctx.path = '/combojs'
        ctx.url = '/combojs??test1.js,test2.js,jq.cn/core.js'

        comboInst
            .root(path.join(__dirname, './'))
            .maxAge(60 * 60)
            .dftTransform(['less'])
            .remoteCache(true)
            .hooks('combojs', {
                dir: path.join(__dirname, './cmps'),
                allow_ext: ['js'],
                'on-mini': 'jsmini',
                realpath: (filename, ext, domain, remoteMap) => {

                    if (!domain) {
                        return path.join(__dirname, './cmps', filename, 'cmp.js')
                    }

                    let realUrl = remoteMap[domain.replace('/', '')]

                    console.log('test:', domain.replace('/', ''), remoteMap, realUrl)

                    return [realUrl + filename + ext, path.join(__dirname, './', domain, filename + ext)]
                }
            })

        comboInst.middlewares()(ctx, next)
            .then(() => {
                ctx.body && ctx.body.pipe(process.stdout)

                //含有远程下载操作最好保证小于2000ms一下的延迟
                setTimeout(function() {
                    done()
                }, 1500)
            })

    })
})