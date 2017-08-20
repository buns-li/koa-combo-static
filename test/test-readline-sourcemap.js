const path = require('path')
const Readline = require('../lib/Sourcemap/readline')

let rdl = new Readline()

rdl.load(path.join(__dirname, './combo_map.txt')).then(rslt => console.log(rslt))
