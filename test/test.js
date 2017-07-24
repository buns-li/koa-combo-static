'use strict'

//const should = require('should')

const combo = require('../')

const path = require('path')

function next() {
    console.log('next')
}

process.on('unhandledRejection', (reason, p) => {
    console.warn('Unhandled Rejection at: Promise ', p, ' reason: ', reason)
})

let ctx = {
    method: 'GET',
    headers: {},
    set: (val) => console.log(val)
}

// ctx.path = '/js/test.js'
// ctx.url = '/js/test.js'

// ctx.path = '/css/test.css'
// ctx.url = '/css/test.css'

ctx.path = '/combo/js'
ctx.url = '/combo/js??test1.js,test2.js,jq.cn/core.js'

// ctx.path = '/combo/css'
// ctx.url = '/combo/css??test1.less,test2.less'

combo({
        root: path.join(__dirname, './'),
        prefix: ['combo/js', 'combo/css'],
        combo_map_path: path.join(__dirname, './combo_map.txt'),
        remote_map: {
            'jq.cn': 'https://cdn.bootcss.com/jquery/3.2.1/'
        },
        path_map: {
            '/combo/js': {
                dir: path.join(__dirname, './cmps'),
                allow_ext: ['js'],
                cat: 'js',
                realpath: (dir, filename, ext, version, domain) => {
                    if (domain) {
                        return path.join(dir, domain, filename + ext)
                    }
                    return path.join(dir, filename, 'cmp' + ext)
                }
            },
            '/combo/css': {
                dir: path.join(__dirname, './cmps'),
                allow_ext: ['css', 'less'],
                cat: 'css',
                realpath: (dir, filename, ext, version, domain) => {
                    return path.join(dir, filename, 'cmp' + ext)
                }
            }
        }

    })(ctx, next)
    .then(() => {
        // ctx.body && ctx.body.pipe(process.stdout)
    })