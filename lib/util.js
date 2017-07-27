'use strict'

const fs = require('fs')

const mkdirp = require('mkdirp')

let COMBOREG, STATICREG

exports.isCombo = function(url, prefix, tag) {

    COMBOREG || (COMBOREG = new RegExp('^\\/(' + prefix.join('|').replace(/\//g, '\\/') + ')\\/?(.*)' + tag.replace(/\?/g, '\\?') + '(.+)$'))

    return url ? url.match(COMBOREG) : false
}

exports.isStatic = function(url, prefix) {

    STATICREG || (STATICREG = new RegExp('^\\/(' + prefix.join('|') + ')\\/(.+)'))

    return url ? url.match(STATICREG) : false
}

exports.fileStatAsync = function(fullpath) {
    return new Promise((resolve, reject) => {
        fs.stat(fullpath, (err, stat) => resolve(err || !stat || !stat.isFile() ? false : stat))
    })
}

exports.getCombodFileName = function(fileStats) {
    let tag = ''
    let sizes = 0
    let times = []
    fileStats.forEach(stat => {
        if (!stat) return

        console.log(stat.mtime.getTime().toString())

        times.push(stat.mtime.getTime().toString())

        sizes += stat.size
    })

    tag = times.join('_').toString(16) + '__' + sizes.toString(16)

    return tag
}

exports.judgeRealExt = function(ext) {
    if (ext === 'js' || ext === 'ts' || ext === 'coffee') return 'js'

    else if (ext === 'css' || ext === 'scss' || ext === 'less' || ext === 'styl') return 'css'

    else if (ext === 'html' || ext === 'njk' || ext === 'art' || ext === 'dot' || ext === 'ejs') return 'tpl'

    return ext
}

exports.mkdir = function(dirFullPath) {
    return new Promise((resolve, reject) => {
        mkdirp(dirFullPath, function(err) {
            if (err) {
                console.warn(err)
                return resolve(false)
            }
            return resolve(true)
        })
    })
}

exports.getTypeStr = function(val) {
    let typeStr = Object.prototype.toString.call(val)
    return typeStr.replace('[object ', '').replace(']', '')
}

const isType = exports.isType = function(type) {
    return function(obj) {
        return Object.prototype.toString.call(obj) === '[object ' + type + ']'
    }
}

exports.isFunction = isType('Function')
exports.isArray = Array.isArray || isType('Array')
exports.isString = isType('String')