'use strict'

const EventEmitter = require('events').EventEmitter

module.exports = class ComboSourceMap extends EventEmitter {

    constructor() { super() }

    load(filepath) {}

    getETag(comboKey) {}

    append(content) {}
}