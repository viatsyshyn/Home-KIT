import * as http from "http";
import * as url from "url";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as errorHandler from "errorhandler";
import * as methodOverride from "method-override";

import * as routes from "./routes";
import * as db from "./db";

import {
    IConfig
} from 'config.d.ts';

// Configuration
const config: IConfig = require('./config.json');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', { layout: false });
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(express.static(__dirname + '/public'));

var env = process.env.NODE_ENV || 'development';
if (env === 'development') {
    app.use(errorHandler());
}


// Routes
app.get('/', routes.home(db));

let port = config.port || 3000;
db.init(config.storage, () => {
    app.listen(port, function(){
        console.log("Demo Express server listening on port %d in %s mode", port, app.settings.env);
    });
});

export var App = app;