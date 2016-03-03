# nb-json-db
light weight, REST based , JSON db server.


## Use case
Use only when you require simple and lightweight db with rest api and data saving in JSON.


## Installation
```
npm i nb-json-db
```

## Configuration
```javascript
var nbServer = require('nb-json-db');
//Setting up directory where json files to be saved
nbServer.rootPath = __dirname;

//folder name under the rootPath where json files saved
nbServer.dBFolderName = "data";

//server runs on mentioned port
nbServer.dBPort = 5654;
```

## Declaring Tables and Fields
```javascript
/*
    nbServer.ModelHash[<TableName>] = function(obj) {
        //Id field is used  for unique identification purpose
        //nbServer.guid() return unique guid for each entry
        this.Id = obj["Id"] || nbServer.guid();
        this.<FieldName> = obj[<FieldName>];
    };
*/

//In below example, sever will create json file like 'movies.json' under folder mentioned as earlier.
nbServer.ModelHash["movies"] = function (obj) {
    this.Id = obj["Id"] || nbServer.guid();
    this.Name = obj["Name"];
    this.ExpectedReleaseDate = obj["ExpectedReleaseDate"];
    //use timeStamp format to maintain consistency accross db.
    this.ActualReleaseDate = obj["ActualReleaseDate"];
};

```

### Start server
```javascript
// Will start server on '5654' port as mentioned earlier and create json files if it running on first time
nbServer.init();
```

### End Usage

open browser and hit "http://localhot:5654" to see list of tables in db.


##### Add, update and delete
use any rest clients like postman...etc., or make traditional ajax requests from your app.

Adding entry to 'movies' table
```
Method  : POST
Url     : 'http://localhot:5654/table/movies'
Data    : { "Name": "Dead Pool", "ActualReleaseDate": "1456986954475" }
```


Getting list of 'movies'
```
Method  : GET
Url     : 'http://localhot:5654/table/movies'
```

Updating entry in 'movies' table
```
Method  : POST
Url     : 'http://localhot:5654/table/movies'
Data    : { "Id": "2df234sdf23fs324ddfds2342fd", "Name": "Dead Pool", "ActualReleaseDate": "1456986954475" }
```

Deleting entry in 'movies' table
```
Method  : DELETE
Url     : 'http://localhot:5654/table/movies?Id=2df234sdf23fs324ddfds2342fd'
```
