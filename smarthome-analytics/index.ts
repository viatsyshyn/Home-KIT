import * as express from "express";
import * as process from 'process';
import * as bodyParser from "body-parser";
import * as errorHandler from "errorhandler";
import * as methodOverride from "method-override";

import * as routes from "./routes";
import * as db from "./db";
import {
    LoggerFactory
} from './logger';

import {
    IConfig
} from './config';

// Configuration
const config: IConfig = require('./config.json');

const logger = LoggerFactory('analytics');

const app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.set('view options', { layout: false });
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());
app.use(express.static(__dirname + '/public'));

const env = process.env.NODE_ENV || 'development';
if (env === 'development') {
    app.use(errorHandler());
}

// Routes
app.get('/', routes.home(db));

let port = config.port || 3000;
db.init(logger, config.storage, () => {
    app.listen(port, function(){
        logger.info("SmartHome Analytics listening on port %d in %s mode", port, app.settings.env);
    });
});

export const App = app;