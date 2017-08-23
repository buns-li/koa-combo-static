'use strict'

const fs = require('fs')

const mkdirp = require('mkdirp')

let COMBOREG, STATICREG

exports.isCombo = function (url, prefix, tag) {

    COMBOREG || (COMBOREG = new RegExp('^\\/(' + prefix.join('|').replace(/\//g, '\\/') + ')\\/?(.*)' + tag.replace(/\?/g, '\\?') + '(.+)$'))

    return url ? url.match(COMBOREG) : false
}

exports.isStatic = function (url, prefix) {

    STATICREG || (STATICREG = new RegExp('^\\/(' + prefix.join('|') + ')\\/(.+)'))

    return url ? url.match(STATICREG) : false
}

exports.isRemoteUrl = function (filepath) {

    if (filepath) {

        filepath = String(filepath).toLowerCase()

        return filepath.startsWith('http://') || filepath.startsWith('https://') || filepath.startsWith('//')
    }

    return false
}

exports.fileStatAsync = function (fullpath) {
    return new Promise((resolve, reject) => {
        fs.stat(fullpath, (err, stat) => resolve(err || !stat || !stat.isFile() ? false : stat))
    })
}

exports.getCombodFileName = function (fileStats) {
    let tag = ''
    let sizes = 0
    let times = []
    fileStats.forEach(stat => {
        if (!stat) return

        times.push(stat.mtime.getTime().toString())

        sizes += stat.size
    })

    tag = times.join('_').toString(16) + '__' + sizes.toString(16)

    return tag
}

exports.judgeRealExt = function (ext) {

    let rslt

    switch (ext) {
        case 'css':
        case 'scss':
        case 'less':
        case 'styl':
            rslt = 'css'
            break
        case 'html':
        case 'njk':
        case 'art':
        case 'dot':
        case 'ejs':
        case 'pug':
        case 'jade':
            rslt = 'tpl'
            break
        case 'js':
        case 'ts':
        case 'coffee':
        case 'njk_js':
        case 'art_js':
        case 'dot_js':
        case 'ejs_js':
        case 'pug_js':
        case 'jade_js':
        default:
            rslt = 'js'
            break
    }

    return rslt
}

exports.mkdir = function (dirFullPath) {
    return new Promise((resolve, reject) => {
        mkdirp(dirFullPath, function (err) {
            if (err) {
                console.warn(err)
                return resolve(false)
            }
            return resolve(true)
        })
    })
}

exports.getTypeStr = function (val) {
    let typeStr = Object.prototype.toString.call(val)
    return typeStr.replace('[object ', '').replace(']', '')
}

const isType = exports.isType = function (type) {
    return function (obj) {
        return Object.prototype.toString.call(obj) === '[object ' + type + ']'
    }
}

exports.isFunction = isType('Function')
exports.isArray = Array.isArray || isType('Array')
exports.isString = isType('String')
