let Dexie = require('dexie');
const conf = require('./conf');
const  db = new Dexie(conf.get('dbname'));
db.version(1).stores({
    history: "++id,url,image_url,date,file"
});
module.exports.db = db;