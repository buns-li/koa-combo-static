const path = require('path')
const readline = require('../lib/Sourcemap/readline')

let rdl = new readline()

rdl.load(path.join(__dirname, './combo_map.txt')).then(rslt => console.log(rslt))