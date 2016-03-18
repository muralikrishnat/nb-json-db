var http = require('http');
var url = require('url');

var formidable = require('formidable');
var Utl = require('./lib/util');
var _ = require('lodash');

var $E = {};

$E.Tables = [];
var routings = [];

$E.guid = Utl.guid;
$E.ModelHash = {};
$E.rootPath = "";
$E.dBFolderName = "";
$E.dBPort = 5654;
$E.IsSecure = false;
$E.RootUserName = "admin";
$E.RootPassword = "admin";

$E.allowOrigin = "http://localhost:3434";


var loggedInTokens = [{ token: "96c737144c13f151ebbbaebd1537a28eb80"}];

var fallBackRoute = function (req, res, headers) {
    headers["Content-Type"] = "text/json";
    res.writeHead(200, headers);
    var resObject = {};
    resObject.Body = {
        "Available Routes": [{
            "Url": "/authenticate?username=val&password=val",
            "Methods": "GET, POST",
            "Usage": "Authentication for DB"
        },{
            "Url": "/table/tablename",
            "Methods": "GET",
            "Usage": "Get Table Data"
        },{
            "Url": "/table/tablename",
            "Methods": "POST",
            "Usage": "Update Table row If POST data have Id field otherwise Add table row"
        },{
            "Url": "/table/tablename?Id=val",
            "Methods": "DELETE",
            "Usage": "Delete Table row based on ID value passed in query param"
        },{
            "Url": "/login?username=val&password=val",
            "Methods": "GET",
            "Usage": "Authentication for Application, this route will be available only when users table exists in DB and LoginFields settings check out nb-json-db npm module for more details."
        }]
    };
    res.end(JSON.stringify(resObject));
};

var checkAuthentication = function (req, res, headers, options) {
    if (!Utl.isAuthenticated(req)) {
        var resObject = {};
        resObject.Status = "Failed";
        resObject.Body = options.Msg;
        Utl.sendResObject(res, headers, resObject);
    }
};

var createServer = function () {
    return http.createServer(function (req, res) {
        var headers = {};

        headers['Access-Control-Allow-Origin'] = $E.allowOrigin;
        headers['Access-Control-Allow-Credentials'] = true;
        headers['Access-Control-Allow-Headers'] = 'content-type';
        headers['Access-Control-Allow-Methods'] = 'DELETE,GET,POST';

        if (!$E.IsDevelopment) {
            if (!req.headers.referer) {
                var resObject = {};
                resObject.Status = "Failed";
                resObject.Body = "Authentication is Failed. Debug mode is disabled.";
                Utl.sendResObject(res, headers, resObject);
            }
        }
        var isRouteFound = false, fnToCall = null;
        _.forEach(routings, function (lItem) {
            var reqUrl = url.parse(req.url);
            if (lItem.Url === reqUrl.pathname) {
                isRouteFound = true;
                fnToCall = lItem.Fn;
            }
        });

        if (isRouteFound && fnToCall) {
            fnToCall.call(null, req, res, headers);
        } else {
            fallBackRoute(req, res, headers);
        }
    });
};

var parseTableRow = function (tName, reqData, isNew, isUpdate) {
    var obj = {};
    if ($E.ModelHash[tName.toLowerCase()]) {
        if($E.ModelHash[tName.toLowerCase()].EncryptedFields && $E.ModelHash[tName.toLowerCase()].EncryptedFields instanceof Array){
            $E.ModelHash[tName.toLowerCase()].EncryptedFields.forEach(function (fieldItem) {
                var fieldValue = reqData[fieldItem];
                if(fieldValue) {
                    reqData[fieldItem] = Utl.Crypto.encode(fieldValue);
                }
            });
            obj = new $E.ModelHash[tName.toLowerCase()](reqData, isNew, isUpdate);
        }else {
            obj = new $E.ModelHash[tName.toLowerCase()](reqData, isNew, isUpdate);
        }
    }
    return obj;
};

var parseFormFields = function (req) {
    return new Promise(function (resolve, reject) {
        var form = new formidable.IncomingForm();
        try {
            form.parse(req, function (err, fields, files) {
                resolve(fields);
            });
        } catch (r) {
            resolve({});
        }
    });

};

function getParameterByName(name, url) {
    return new Promise(function (resolve, reject) {
        name = name.replace(/[\[\]]/g, "\\$&");
        var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
            results = regex.exec(url);
        var queryParamVal = null;
        if (!results) {
            resolve(queryParamVal);
        }
        if (!results[2]) {
            resolve(queryParamVal);
        }
        queryParamVal = decodeURIComponent(results[2].replace(/\+/g, " "));
        resolve(queryParamVal);
    });
}




var checkUsername = function (username) {
    return new Promise(function (resolve, reject) {
        if(username){
            var usersTable = $E.ModelHash[$E.LoginFields.TableName];
            if (usersTable) {
                Utl.DB.getTable($E.LoginFields.TableName, $E.ModelHash).then(function (users) {
                    var userFound = users.list.filter(function (userItem) {
                        return userItem[$E.LoginFields.Fields.UserNameField] == username;
                    });
                    if(userFound && userFound.length > 0){
                        resolve({ "IsExists": true});
                    }else{
                        resolve({ "IsExists": false});
                    }
                });
            }else{
                resolve({ "IsExists": false});
            }

        }else{
            resolve({ "IsExists": false});
        }
    });
};

var tableRequestHandler = function (req, res, headers) {
    var resObject = {};
    var tName = this.tName;
    Utl.isAuthenticatedAsync(req, loggedInTokens).then(function (resp) {
        if(resp.IsAuthenticated){
            if (tName) {
                var reqPromise = null;
                switch (req.method.toUpperCase()) {
                    case 'GET':
                        reqPromise = Utl.DB.getTable(tName, $E.ModelHash).then(function (resp) {
                            if($E.ModelHash[tName.toLowerCase()].EncryptedFields && $E.ModelHash[tName.toLowerCase()].EncryptedFields instanceof Array){
                                var responseList = [];
                                if(resp.list){
                                    resp.list.forEach(function (rowItem) {
                                        var itemToShow = {};
                                        Object.keys(rowItem).forEach(function (fieldName) {
                                            itemToShow[fieldName] = rowItem[fieldName];
                                        });
                                        $E.ModelHash[tName.toLowerCase()].EncryptedFields.forEach(function (securedFieldItem) {
                                            delete itemToShow[securedFieldItem];
                                        });
                                        responseList.push(itemToShow);
                                    });
                                }
                                return {list: responseList};
                            }else{
                                return resp;
                            }

                        });
                        break;
                    case 'POST':
                        reqPromise = parseFormFields(req).then(function (formFields) {
                            if (formFields.Id) {
                                var tData = parseTableRow(tName, formFields, false, true);
                                if($E.LoginFields && $E.LoginFields.TableName && $E.LoginFields.Fields && tName.toUpperCase() === $E.LoginFields.TableName.toUpperCase()){
                                    if(resp.UserInfo.UserType && (resp.UserInfo.UserType === "ADMIN" || resp.UserInfo.UserType === "ROOT")) {
                                        //Even Admin or Root can't change username for now.
                                        if ($E.LoginFields.Fields.UserNameField && tData[$E.LoginFields.Fields.UserNameField]) {
                                            delete tData[$E.LoginFields.Fields.UserNameField];
                                        }
                                    }else{
                                        if ($E.LoginFields.Fields.UserNameField && tData[$E.LoginFields.Fields.UserNameField]) {
                                            delete tData[$E.LoginFields.Fields.UserNameField];
                                        }

                                        if ($E.LoginFields.Fields.UserTypeField && tData[$E.LoginFields.Fields.UserTypeField]) {
                                            delete tData[$E.LoginFields.Fields.UserTypeField];
                                        }
                                    }
                                }
                                if (Utl.DB.updateTableRow(tName, tData)) {
                                    return Utl.DB.writeTable(tName).then(function () {
                                        var tDataResp = Utl.getCopyObject(tData);
                                        if (tDataResp) {
                                            if ($E.ModelHash[tName.toLowerCase()].EncryptedFields && $E.ModelHash[tName.toLowerCase()].EncryptedFields instanceof Array) {
                                                $E.ModelHash[tName.toLowerCase()].EncryptedFields.forEach(function (securedFieldItem) {
                                                    delete tDataResp[securedFieldItem];
                                                });
                                            }
                                        }
                                        return tDataResp;
                                    });
                                } else {
                                    return {Status: "No dude"};
                                }
                            } else {
                                if($E.LoginFields && $E.LoginFields.TableName && tName.toUpperCase() === $E.LoginFields.TableName.toUpperCase()){
                                    if(resp.UserInfo.UserType && (resp.UserInfo.UserType === "ADMIN" || resp.UserInfo.UserType === "ROOT")){
                                        var tData = parseTableRow(tName, formFields, true, false);
                                        if(tData[$E.LoginFields.Fields.UserNameField]) {
                                            return checkUsername(tData[$E.LoginFields.Fields.UserNameField]).then(function (trr) {
                                                if(trr.IsExists){
                                                    return { Status: "Failed", "Msg": "Username already Exists."}
                                                }else{
                                                    if (Utl.DB.addTableRow(tName, tData)) {
                                                        return Utl.DB.writeTable(tName).then(function () {
                                                            var tDataResp = Utl.getCopyObject(tData);
                                                            if (tDataResp) {
                                                                if ($E.ModelHash[tName.toLowerCase()].EncryptedFields && $E.ModelHash[tName.toLowerCase()].EncryptedFields instanceof Array) {
                                                                    $E.ModelHash[tName.toLowerCase()].EncryptedFields.forEach(function (securedFieldItem) {
                                                                        delete tDataResp[securedFieldItem];
                                                                    });
                                                                }
                                                            }
                                                            return tDataResp;
                                                        });
                                                    } else {
                                                        return {Status: "No dude"};
                                                    }
                                                }
                                            });

                                        }else{
                                            return { Status: "Failed", "Msg": "Required fields are missing."}
                                        }
                                    }else{
                                        return { Status: "Failed", "Msg": "Permission Denied"}
                                    }
                                }else {
                                    var tData = parseTableRow(tName, formFields, true, false);
                                    if (Utl.DB.addTableRow(tName, tData)) {
                                        return Utl.DB.writeTable(tName).then(function () {
                                            return tData;
                                        });
                                    } else {
                                        return {Status: "No dude"};
                                    }
                                }
                            }
                        });
                        break;
                    case 'DELETE':
                        reqPromise = getParameterByName("Id", req.url).then(function (val) {
                            if (val) {
                                if($E.LoginFields && $E.LoginFields.TableName && tName.toUpperCase() === $E.LoginFields.TableName.toUpperCase()){
                                    if(resp.UserInfo.UserType && (resp.UserInfo.UserType === "ADMIN" || resp.UserInfo.UserType === "ROOT")){
                                        var tData = parseTableRow(tName, {"Id": val});
                                        if (Utl.DB.deleteTableRow(tName, tData)) {
                                            return Utl.DB.writeTable(tName).then(function () {
                                                return tData;
                                            });
                                        } else {
                                            return {Status: "No dude"};
                                        }
                                    }else{
                                        return {Status: "Failed", "Msg": "Permission Denied."};
                                    }
                                }else {
                                    var tData = parseTableRow(tName, {"Id": val});
                                    if (Utl.DB.deleteTableRow(tName, tData)) {
                                        return Utl.DB.writeTable(tName).then(function () {
                                            return tData;
                                        });
                                    } else {
                                        return {Status: "No dude"};
                                    }
                                }
                            } else {
                                return {Status: "No dude"};
                            }
                        });

                        break;
                }

                headers["Content-Type"] = "text/json";
                if (reqPromise) {
                    reqPromise.then(function (tData) {
                        resObject.Body = tData;
                        Utl.sendResObject(res, headers, resObject);
                    });
                } else {
                    Utl.sendResObject(res, headers, resObject);
                }
            } else {
                Utl.sendResObject(res, headers, resObject);
            }
        }else{
            resObject.Msg = "Login required to get Access DB. Please provide authentication details";
            resObject.Details = resp.Details;
            Utl.sendResObject(res, headers, resObject);
        }
    });


};


var dbAuthenticateHandler = function (req, res, headers) {
    var resObject = {}, reqPromise;
    headers["Content-Type"] = "text/json";
    switch (req.method.toUpperCase()) {
        case 'GET':
            reqPromise = getParameterByName('username', req.url).then(function (username) {
                if (username && username === $E.RootUserName) {
                    return getParameterByName('password', req.url).then(function (password) {
                        if (password && password === $E.RootPassword) {
                            var token = Utl.guid();
                            loggedInTokens.push({ token: token, Username: username, UserType: "ROOT" });
                            return { tokenObject: token };
                        } else {
                            return {};
                        }
                    });
                } else {
                    return {};
                }
            });
            break;
        case 'POST':
            reqPromise = parseFormFields(req).then(function (fields) {

            });
            break;
        default:
    }
    if (reqPromise) {
        reqPromise.then(function (bdy) {
            resObject.Body = bdy;
            Utl.sendResObject(res, headers, resObject);
        });
    } else {
        Utl.sendResObject(res, headers, resObject);
    }
};

var loginHandler = function (req, res, headers) {
    var resObject = {}, reqPromise;
    headers["Content-Type"] = "text/json";
    Utl.isAuthenticatedAsync(req, loggedInTokens).then(function (resp) {
        if(resp.IsAuthenticated){
            resObject.Body = {tokenObject: resp.UserInfo.token, UserId: resp.UserInfo.UserId, Username: resp.UserInfo.Username, UserType: resp.UserInfo.UserType };
            Utl.sendResObject(res, headers, resObject);
        }else {
            switch (req.method.toUpperCase()) {
                case 'GET':
                    reqPromise = getParameterByName('username', req.url).then(function (username) {
                        if (username) {
                            var usersTable = $E.ModelHash[$E.LoginFields.TableName];
                            if (usersTable) {
                                return Utl.DB.getTable($E.LoginFields.TableName, $E.ModelHash).then(function (users) {
                                    var userFound = users.list.filter(function (userItem) {
                                        return userItem[$E.LoginFields.Fields.UserNameField] == username;
                                    });
                                    if (userFound && userFound.length > 0) {
                                        var userData = userFound[0];
                                        return getParameterByName('password', req.url).then(function (password) {
                                            var passwordToCheck = userData[$E.LoginFields.Fields.PasswordField];
                                            var decodedPassword = Utl.Crypto.decode(passwordToCheck);
                                            if (password && password === decodedPassword) {
                                                var token = Utl.guid();
                                                headers['Set-Cookie'] = 'lToken=' + token;
                                                loggedInTokens.push({
                                                    token: token,
                                                    Username: username,
                                                    UserType: userData.UserType,
                                                    UserId: userData.Id
                                                });
                                                return {tokenObject: token, UserId: userData.Id, Username: username, UserType: userData.UserType };
                                            } else {
                                                return {
                                                    "Status": "Failed",
                                                    "Msg": "UserName and Password not matched."
                                                };
                                            }
                                        });
                                    } else {
                                        return {"Status": "Failed", "Msg": "UserName and Password not matched."};
                                    }
                                });
                            }
                        } else {
                            return {"Status": "Failed", "Msg": "UserName and Password not matched."};
                        }
                    });
                    break;
                case 'POST':
                    reqPromise = parseFormFields(req).then(function (fields) {
                        var username = fields[$E.LoginFields.Fields.UserNameField];
                        var password = fields[$E.LoginFields.Fields.PasswordField];
                        if (username) {
                            var usersTable = $E.ModelHash[$E.LoginFields.TableName];
                            if (usersTable) {
                                return Utl.DB.getTable($E.LoginFields.TableName, $E.ModelHash).then(function (users) {
                                    var userFound = users.list.filter(function (userItem) {
                                        return userItem[$E.LoginFields.Fields.UserNameField] == username;
                                    });
                                    if (userFound && userFound.length > 0) {
                                        var userData = userFound[0];
                                        var passwordToCheck = userData[$E.LoginFields.Fields.PasswordField];
                                        var decodedPassword = Utl.Crypto.decode(passwordToCheck);
                                        if (password && password === decodedPassword) {
                                            var token = Utl.guid();
                                            headers['Set-Cookie'] = 'lToken=' + token;
                                            loggedInTokens.push({
                                                token: token,
                                                Username: username,
                                                UserType: userData.UserType,
                                                UserId: userData.Id
                                            });
                                            return {tokenObject: token, UserId: userData.Id, Username: username, UserType: userData.UserType };
                                        } else {
                                            return {
                                                "Status": "Failed",
                                                "Msg": "UserName and Password not matched."
                                            };
                                        }
                                    } else {
                                        return {"Status": "Failed", "Msg": "UserName and Password not matched."};
                                    }
                                });
                            }
                        } else {
                            return {"Status": "Failed", "Msg": "UserName and Password not matched."};
                        }
                    });
                    break;
                default:
            }
            if (reqPromise) {
                reqPromise.then(function (bdy) {
                    resObject.Body = bdy;
                    Utl.sendResObject(res, headers, resObject);
                });
            } else {
                Utl.sendResObject(res, headers, resObject);
            }
        }
    });

};


$E.init = function () {

    var server = createServer();

    $E.Tables = Object.keys($E.ModelHash);

    Utl.DB.Tables = $E.Tables;
    Utl.DB.rootPath = $E.rootPath;
    Utl.DB.folderName = $E.dBFolderName;

    Utl.DB.ModelHash = $E.ModelHash;


    Utl.DB.Tables.forEach(function (lItem) {
        routings.push(new Utl.RouteClass('/table/' + lItem.toLowerCase(), tableRequestHandler.bind({tName: lItem})));
    });

    routings.push(new Utl.RouteClass('/authenticate', dbAuthenticateHandler));
    if($E.LoginFields) {
        if($E.LoginFields.TableName && $E.LoginFields.Fields) {
            if($E.LoginFields.Fields.UserNameField && $E.LoginFields.Fields.PasswordField) {
                routings.push(new Utl.RouteClass('/login', loginHandler));
            }
        }
    }


    Utl.DB.createDB().then(function () {
        Utl.DB.loadDB().then(function () {
            server.listen($E.dBPort, function () {
                console.log((new Date()) + ' Server is listening on port 5654');
            });
        });
    });
};

module.exports = $E;