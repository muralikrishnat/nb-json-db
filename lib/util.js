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
    switch (len){
        case 4:
            return s4();
            break;
        case 8:
            return s4() + s4();
            break;
        case 12:
            return s4() + s4() + s4();
            break;
    }
    return s4() + s4() + s4() + s4() + s4() + s4() + (new Date).getTime().toString(16);
};

var crypto = require('crypto'),algorithm = 'aes-256-ctr';

U.Crypto = {
    encode: function (contentToEncode) {
        var cipherKey = U.guid(8);
        var cipher = crypto.createCipher(algorithm, cipherKey);
        var crypted = cipher.update(contentToEncode,'utf8','hex');
        crypted += cipher.final('hex');
        return cipherKey + crypted;
    },
    decode: function (contentToDecode) {
        var password = contentToDecode.substr(0, 8);
        var decipher = crypto.createDecipher(algorithm,password);
        var dec = decipher.update(contentToDecode.substr(8),'hex','utf8');
        dec += decipher.final('utf8');
        return dec;
    }
};


U.getCookies = function (req) {
    var reqCookies = {};
    if (req.headers && req.headers.cookie) {
        reqCookies = cookie.parse(req.headers.cookie);
    }
    return reqCookies;
};

U.getQueryParamSync = function (name, url) {
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
        results = regex.exec(url);
    var queryParamVal = null;
    if (!results){
        return queryParamVal;
    }
    if (!results[2]){
        return queryParamVal;
    }
    queryParamVal = decodeURIComponent(results[2].replace(/\+/g, " "));
    return queryParamVal;
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

U.isAuthenticated = function (req) {
    if(req.headers && req.headers.cookie){
        var reqCookies = cookie.parse(req.headers.cookie);
        if(reqCookies.lToken){
            return true;
        }
    }
    return false;
};

U.isLoginTokenValid = function (lToken, tokens) {
    var isTokenValid = false;
    tokens.forEach(function (tokenItem) {
        if(lToken == tokenItem.token){
            isTokenValid = { tokenDetails: tokenItem};
            return isTokenValid;
        }
    });
    return isTokenValid;
};

U.isAuthenticatedAsync = function (req, tokens) {
    return new Promise(function (resolve, reject) {
        var loginToken = null;
        if(req.headers && req.headers.cookie){
            var reqCookies = cookie.parse(req.headers.cookie);
            if(reqCookies.lToken){
                loginToken = reqCookies.lToken;
            }
        }

        loginToken = U.getQueryParamSync('lToken', req.url) || loginToken;
        if(loginToken){
            var loggedInToken = U.isLoginTokenValid(loginToken, tokens);
            if(loggedInToken){
                resolve({"IsAuthenticated": true, UserInfo: loggedInToken.tokenDetails});
            }else {
                resolve({ "IsAuthenticated": false, "Details": "oAuth token Expired"});
            }
        }else{
            resolve({ "IsAuthenticated": false, "Details": "oAuth token Not found"});
        }

    });
};

U.getCopyObject = function (src) {
    var itemToShow = {};
    Object.keys(src).forEach(function (fieldName) {
        itemToShow[fieldName] = src[fieldName];
    });
    return itemToShow;
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

var loadFromJSON = function (tName, ModelHash) {
    return new Promise(function (resolve, reject) {
        fs.readFile(DB.rootPath + '/' + DB.folderName + '/' + tName.toLowerCase() + '.json', {}, function (err, data) {
            if(err){
                resolve({});
            }else{
                var obj;
                try {
                    obj = JSON.parse(data);
                    var parsedList = [];
                    if(obj.list){
                        obj.list.forEach(function (objItem) {
                            parsedList.push(DB.parseTableRow(ModelHash, tName, objItem, false, false));
                        });
                        obj.list = parsedList;
                    }
                    //DB.cache.set(tName, obj);
                    resolve(obj);
                } catch (err2) {  }
                resolve({});
            }

        });
    });
};

DB.getTable = function (tName, ModelHash) {
    return new Promise(function (resolve, rej) {
        var tableData = DB.cache.get(tName);
        if(tableData){
            resolve(tableData);
        }else{
            loadFromJSON(tName, ModelHash).then(function (res) {
                DB.cache.set(tName, res);
                resolve(res);
            })
        }
    });

};

DB.parseTableRow = function (ModelHash, tName, reqData, isNew, isUpdate) {
    var obj = {};
    ModelHash = ModelHash || DB.ModelHash;
    if (ModelHash[tName.toLowerCase()]) {
        obj = new ModelHash[tName.toLowerCase()](reqData, isNew, isUpdate);
    }
    return obj;
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