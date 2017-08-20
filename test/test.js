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
    root: path.join(__dirname, './'),
    maxAge: 60 * 60,
    dftTransform: ['less'],
    remoteMap: {
        'jq.cn': 'https://cdn.bootcss.com/jquery/3.2.1/'
    },
    remoteCache: true,
    cacheMapOption: {
        filepath: path.join(__dirname, './combo_map.txt')
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

    it('should response combo stream which have remote url request', function (done) {

        ctx.path = '/combojs'
        ctx.url = '/combojs??test1.js,test2.js,jq.cn/core.js'

        comboFunc
            .hooks('combojs', {
                'dir': path.join(__dirname, './cmps'),
                'allow_ext': ['js'],
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
            .middleware()(ctx, next).then(() => {

                ctx.body && ctx.body.pipe(process.stdout)

                //含有远程下载操作最好保证小于2000ms一下的延迟
                setTimeout(function () {
                    done()
                }, 1500)
            })

    })

})
