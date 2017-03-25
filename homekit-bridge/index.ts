import * as process from 'process';

import {IConfig} from './api/config';
import {LoggerFactory} from './lib/logger';
import cache from "./lib/cache";
import storage from "./lib/storage";
import pubsub from "./lib/pubsub";
import {BridgeFactory, hap} from "./lib/hap";
import {IRuntime} from "./api/runtime";

const logger = LoggerFactory('homekit-bridge');

logger.log("HomeKit-bridge starting...");

const config: IConfig = require('./config.json');

Promise.all([
        cache.init(config.cache),
        storage.init(config.storage),
        pubsub.init(config.pubsub)
    ])
    .then(() => {
        const runtime : IRuntime = {
            uuid: hap.uuid,
            Accessory: hap.Accessory,
            Service: hap.Service,
            Characteristic: hap.Characteristic,

            getLogger: LoggerFactory,
            pubsub: pubsub,
            storage: storage,
            cache: cache
        };

        const accessories = config.accessories.map(x => require(x.package)(runtime, x));

        const bridge = BridgeFactory(config, accessories);

        const signals = { 'SIGINT': 2, 'SIGTERM': 15 };
        Object.keys(signals).forEach( signal =>
            process.on(signal, () => {
                logger.info("Got %s, shutting down Homebridge...", signal);
                bridge.destroy();
                process.exit(128 + signals[signal]);
            }));
    })
    .then(() => {
        pubsub.sub_raw('#', (message, topic) => {

            logger.info('RECEIVED:', topic, message);

            let parts = topic.split('/');
            let state = parts.pop();
            let device = parts.join('/');
            let msg = null;

            try {
                msg = JSON.parse(message.toString());
            } catch (e) {}

            storage.insert({
                timestamp: new Date().getTime(),
                device: device,
                state: state,
                topic: topic,
                message: msg,
                raw: message.toString()
            });
        })
    })
    .catch(logger.error);
