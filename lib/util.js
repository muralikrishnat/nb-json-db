var U = {};

var cookie = require('cookie');

U.guid = function(len) {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    if(len == 8){
        return s4() + s4();
    }
    return s4() + s4() + s4() + s4() + s4() + s4() + (new Date).getTime().toString(16);
};

U.getCookies = function (req) {
    var reqCookies = {};
    if (req.headers && req.headers.cookie) {
        reqCookies = cookie.parse(req.headers.cookie);
    }
    return reqCookies;
};

U.makerequestold = function (headers) {
    headers['Set-Cookie'] = 'cuid=' + U.guid();
    return headers;
};

U.isNewRequest = function (req) {
    if(req.headers && req.headers.cookie){
        var reqCookies = cookie.parse(req.headers.cookie);
        if(reqCookies.cuid){
            return false;
        }
    }
    return true;
};

U.RouteClass = function (u, f) {
    this.Url = u;
    this.Fn = f;
};

U.sendResObject = function (res, headers, resObject) {
    res.writeHead(200, headers);
    res.end(JSON.stringify(resObject));
};


var fs = require('fs');
var LRU = require('lrucache');
var _ = require('lodash');

var DB = {};
DB.cache = LRU({max: 1000});
DB.Tables = [];
DB.templateJSON = {"list":[]};
DB.rootPath = '';

DB.folderName = 'data';

var checkTableAndCreate = function (tName) {
    return new Promise(function (resolve, reject) {
        fs.exists(DB.rootPath + '/' + DB.folderName + '/' + tName.toLowerCase() + '.json', function (isFileExists) {
            if(!isFileExists){
                DB.writeTable(tName, DB.templateJSON).then(function () {
                    resolve({});
                });
            }else{
                resolve({});
            }
        })
    });
};

var loadFromJSON = function (tName) {
    return new Promise(function (resolve, reject) {
        fs.readFile(DB.rootPath + '/' + DB.folderName + '/' + tName.toLowerCase() + '.json', {}, function (err, data) {
            if(err){
                resolve({});
            }else{
                var obj;
                try {
                    obj = JSON.parse(data);
                    //DB.cache.set(tName, obj);
                    resolve(obj);
                } catch (err2) {  }
                resolve({});
            }

        });
    });
};

DB.getTable = function (tName) {
    return new Promise(function (resolve, rej) {
        var tableData = DB.cache.get(tName);
        if(tableData){
            resolve(tableData);
        }else{
            loadFromJSON(tName).then(function (res) {
                DB.cache.set(tName, res);
                resolve(res);
            })
        }
    });

};

DB.addTableRow = function (tName, tRowObj) {
    var exeStatus = false;
    var tableData = DB.cache.get(tName);
    if(tableData){
        tableData.list.push(tRowObj);
        exeStatus = true;
    }else{
        exeStatus = false;
    }
    return exeStatus;
};

DB.updateTableRow = function (tName, tRowObj) {
    var exeStatus = false;
    var tableData = DB.cache.get(tName);
    if(tableData){
        var isRowExists = false;
        for(var i =0; i< tableData.list.length; i++){
            var lItem = tableData.list[i];
            if(lItem.Id && lItem.Id === tRowObj.Id){
                Object.keys(tRowObj).forEach(function (lItem) {
                    if(tRowObj[lItem]) {
                        tableData.list[i][lItem] = tRowObj[lItem];
                    }
                });
                isRowExists = true;
                break;
            }
        }
        exeStatus = isRowExists ? true : false;
    }else{
        exeStatus = false;
    }
    return exeStatus;
};

var removeEmptyList = function (lst) {
    return lst.filter(function (x) {
        return x? true: false;
    });
};

DB.deleteTableRow = function (tName, tRowObj) {
    var exeStatus = false;
    var tableData = DB.cache.get(tName);
    if(tableData){
        var isRowExists = false;
        var dIndex = null;
        for(var i =0; i< tableData.list.length; i++){
            var lItem = tableData.list[i];
            if(lItem.Id && lItem.Id == tRowObj.Id){
                dIndex = i;
                isRowExists = true;
                break;
            }
        }
        if(dIndex >= 0){
            delete tableData.list[dIndex];
            tableData.list = removeEmptyList(tableData.list);
        }

        if(isRowExists){
            exeStatus = true;
        }else{
            exeStatus = false;
        }

    }else{
        exeStatus = false;
    }

    return exeStatus;
};

DB.writeTable = function (tName, tData) {
    return new Promise(function (resolve, reject) {
        if(!tData){
            tData = DB.cache.get(tName);
        }
        if(tData) {
            fs.writeFile(DB.rootPath + '/' + DB.folderName + '/' + tName.toLowerCase() + '.json', JSON.stringify(tData), function (err, data) {
                if (err) {

                }
                resolve({});
            });
        }else{
            resolve({});
        }
    });
};

DB.saveToJSON = function () {
    return new Promise(function (res, rej) {
        var promises = [];
        DB.Tables.forEach(function (tName) {
            promises.push(new Promise(function (resolve, reject) {
                var tData = DB.cache.get(tName);
                if(tData) {
                    DB.writeTable(tName, tData).then(function () {
                        resolve({});
                    });
                }else{
                    resolve({});
                }
            }))
        });

        Promise.all(promises).then(function () {
            res({});
        });
    });
};

DB.createDB = function () {
    return new Promise(function (res, rej) {
        var promises = [];
        DB.Tables.forEach(function (tName) {
            promises.push(new Promise(function (resolve, reject) {
                checkTableAndCreate(tName).then(function () {
                    resolve({});
                });
            }))
        });

        Promise.all(promises).then(function () {
            res({});
        });
    });
};

DB.loadDB = function () {
    return new Promise(function (res, rej) {
        var promises = [];
        DB.Tables.forEach(function (tName) {
            promises.push(new Promise(function (resolve, reject) {
                DB.getTable(tName).then(function () {
                    resolve({});
                });
            }))
        });

        Promise.all(promises).then(function () {
            res({});
        });
    });

};

U.DB = DB;



module.exports = U;