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

//provide allowOrigin to allow requests from specific domain.
nbServer.allowOrigin = "http://localhost:3434";

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

//table 'users' is meant for providing authentication to application
nbServer.ModelHash["users"] = function (obj, isNew, isUpdate, options) {
    this.Id = obj["Id"] || nbServer.guid();
    this.Username = obj["Username"];
    this.Password = obj["Password"];

    this.UserType = obj["UserType"]; //ADMIN, USER

    this.EmailId = obj["EmailId"];

    if(isNew){
        this._createdTime = new Date().getTime();
    }else{
        this._createdTime = obj["_createdTime"];
    }

    if(isUpdate){
        this._updatedTime = new Date().getTime();
    }else{
        this._updatedTime = obj["_updatedTime"];
    }
};

```

### Setting up Authentication ( Optional  )
```javascript
//Declaring 'Password' field is encrypted. data will be saving as ecrypted formatted
//Encrypted Fields will not return to API as they are very secured, can only modified by 'ADMIN' or 'ROOT'
//
nbServer.ModelHash["users"].EncryptedFields = ["Password"];

//specifying 'users' table is the authentication table and 'username' and 'password' fields
//and 'UserType' field values can be 'ADMIN' and 'USER' and 'ROOT'
nbServer.LoginFields = {
    "TableName": "users",
    "Fields":{
        "UserNameField": "Username",
        "PasswordField": "Password",
        "UserTypeField": "UserType"
    }
};

//able to hit http://localhost:5654 server from browser If 'IsDevelopment' is 'true'
//otherwise returns Access Denied Error
nbServer.IsDevelopment = true;

//Root username and passowrd for DB
//details will not save under application data.
nbServer.RootUserName = "murali";
nbServer.RootPassword = "murali";
```

### Start server
```javascript
// Will start server on '5654' port as mentioned earlier and create json files if it running on first time
nbServer.init();
```

### End Usage

open browser and hit "http://localhot:5654" to see list of tables in db.

##### Login to Applications
see 'Authenctication to DB' section to add first user in 'users' table.

After adding primary/admin user to 'users' table below url is using for authentication for application.

and '/login' will returns browser cookie and tokenObject as response.

All add, update and delete calls will be serving as it is.except for 'users' table and it is declared as 'LoginFields'

NOTE: works only when 'LoginFields' settings are passed.

```
Url     : "/login?username=val&password=val",
Methods : "GET, POST",
Usage   : "Authentication for DB",
Returns : {
              "Body": {
                "tokenObject": "70a6e008926df678dfd8829e1537e1809fc"
              }
            }
```

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


### Authentication to DB ( Optional - usefull only when 'LoginFields' are passed.)
application used loginToken which will generate by passing root username and root pasword to /authenticate
```
Url     : "/authenticate?username=val&password=val",
Methods : "GET, POST",
Usage   : "Authentication for DB",
Returns : {
              "Body": {
                "tokenObject": "70a6e008926df678dfd8829e1537e1809fc"
              }
            }
```

add primary user to 'users' table using below url
```
"Url"       : "/table/users?lToken=70a6e008926df678dfd8829e1537e1809fc",
"Methods"   : "POST",
"Data"      : {
                "Username": "murali",
                "Password": "murali",
                "UserType": "ADMIN"
                }
```



##### Note:

Recent changes are fully compatable with older version. Main focus only on Authentication by using token concept and encrypting Password fields.


##### Upcoming:

1. UI access for DB tables, all CRUD operations can be done on tables from browser itself.

2. Better encryption for password field.


