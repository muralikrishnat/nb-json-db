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

var fallBackRoute = function (req, res, headers) {
    res.writeHead(200, headers);
    var resObject = {};
    resObject.Tables = $E.Tables;
    res.end(JSON.stringify(resObject));
};


var server = http.createServer(function(req, res) {
    var headers = {};

    headers['Access-Control-Allow-Origin'] = 'http://localhost:3434';
    headers['Access-Control-Allow-Credentials'] = true;
    headers['Access-Control-Allow-Headers'] = 'content-type';
    headers['Access-Control-Allow-Methods'] = 'DELETE,GET,POST';

    if(Utl.isNewRequest(req)){
        Utl.makerequestold(headers);
    }
    var isRouteFound = false, fnToCall = null;
    _.forEach(routings, function (lItem) {
        var reqUrl = url.parse(req.url);
        if(lItem.Url === reqUrl.pathname){
            isRouteFound = true;
            fnToCall = lItem.Fn;
        }
    });

    if(isRouteFound && fnToCall){
        fnToCall.call(null, req, res, headers);
    }else {
        fallBackRoute(req, res, headers);
    }
});




$E.init = function () {
    $E.Tables = Object.keys($E.ModelHash);

    Utl.DB.Tables = $E.Tables;

    Utl.DB.rootPath = $E.rootPath;

    Utl.DB.folderName = $E.dBFolderName;


    var parseTableRow = function (tName, reqData) {
        var obj = {};
        if($E.ModelHash[tName.toLowerCase()]){
            obj = new $E.ModelHash[tName.toLowerCase()](reqData);
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
            }catch (r){
                resolve({});
            }
        });

    };

    function getParameterByName(name, url) {
        return new Promise(function (resolve, reject) {
            name = name.replace(/[\[\]]/g, "\\$&");
            var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
                results = regex.exec(url);
            if (!results) return null;
            if (!results[2]) return '';
            var queryParamVal = decodeURIComponent(results[2].replace(/\+/g, " "));
            resolve(queryParamVal);
        });
    }



    var tableRequestHandler = function (req, res, headers) {
        var resObject = {};
        if(this.tName){
            var tName = this.tName;
            var reqPromise = null;
            switch (req.method.toUpperCase()){
                case 'GET':
                    reqPromise = Utl.DB.getTable(tName);
                    break;
                case 'POST':
                    reqPromise = parseFormFields(req).then(function (formFields) {
                        if(formFields.Id){
                            var tData = parseTableRow(tName, formFields);
                            if(Utl.DB.updateTableRow(tName, tData)){
                                return Utl.DB.writeTable(tName).then(function () {
                                    return tData;
                                });
                            }else{
                                return { Status: "No dude"};
                            }
                        }else{
                            var tData = parseTableRow(tName, formFields);
                            if(Utl.DB.addTableRow(tName, tData)){
                                return Utl.DB.writeTable(tName).then(function () {
                                    return tData;
                                });
                            }else{
                                return { Status: "No dude"};
                            }
                        }
                    });
                    break;
                case 'DELETE':
                    reqPromise = getParameterByName("Id", req.url).then(function (val) {
                        if(val){
                            var tData = parseTableRow(tName, { "Id": val });
                            if(Utl.DB.deleteTableRow(tName, tData)){
                                return Utl.DB.writeTable(tName).then(function () {
                                    return tData;
                                });
                            }else{
                                return { Status: "No dude"};
                            }
                        }else{
                            return { Status: "No dude"};
                        }
                    });

                    break;
            }

            headers["Content-Type"] = "text/json";
            if(reqPromise){
                reqPromise.then(function (tData) {
                    resObject.Body = tData;
                    Utl.sendResObject(res, headers, resObject);
                });
            }else{
                Utl.sendResObject(res, headers, resObject);
            }
        }else{
            Utl.sendResObject(res, headers, resObject);
        }

    };



    Utl.DB.Tables.forEach(function (lItem) {
        routings.push(new Utl.RouteClass('/table/' + lItem.toLowerCase(), tableRequestHandler.bind({ tName: lItem})));
    });


    Utl.DB.createDB().then(function () {
        Utl.DB.loadDB().then(function () {
            server.listen($E.dBPort, function() {
                console.log((new Date()) + ' Server is listening on port 5654');
            });
        });
    });
};

module.exports = $E;