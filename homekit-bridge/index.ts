import * as hap from 'hap-nodejs';
import * as process from 'process';
import * as mqtt from 'mqtt';
import * as fs from 'fs';
import * as Redis from 'redis';
import {
    IConfig
} from 'config.d.ts';
import {
    MongoClient
} from 'mongodb';

const config: IConfig = JSON.parse(fs.readFileSync('./config.json'));

console.log("HomeKit-bridge starting...");

// Initialize our storage system
hap.init();

const uuid = hap.uuid;
const Accessory = hap.Accessory;
const Service = hap.Service;
const Characteristic = hap.Characteristic;

// Our Accessories will each have their own HAP server; we will assign ports sequentially
let targetPort = config.port || 51827;

// Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
// even when restarting our server. We use the `uuid.generate` helper function to create
// a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
const bridgeUUID = uuid.generate('hap-nodejs:accessories:homekit-dridge');

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
const bridge = new Accessory(config.name || 'HomeKitBridge', bridgeUUID);

bridge
    .getService(Service.AccessoryInformation)
    .setCharacteristic(Characteristic.Manufacturer, "SmartHome LLC")
    .setCharacteristic(Characteristic.Model, "HomeKit Bridge Prototype A")
    .setCharacteristic(Characteristic.SerialNumber, "HKB-PTA-0.0.1");

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
bridge.username = config.MAC;
bridge.pincode = config.PIN;

// Listen for bridge identification event
bridge.on('identify', (paired, callback) => {
    console.log("Node Bridge identify");
    callback(); // success
});

const signals = { 'SIGINT': 2, 'SIGTERM': 15 };
Object.keys(signals).forEach( signal =>
    process.on(signal, () => {
        console.info("Got %s, shutting down Homebridge...", signal);
        bridge.destroy();
        process.exit(128 + signals[signal]);
    }));

const mosquittoUrl = config.MQTT;
const redisUrl = config.cache;
const mongoUrl = config.storage;
let storage = null;

const mqttClient = mqtt
    .connect(mosquittoUrl)
    .on('connect', () => {
        console.log(`Connected to ${mosquittoUrl}`);

        const redis = Redis.createClient(redisUrl);

        redis.on('connect', () => {
            console.log(`Connected to ${redisUrl}`);

            const redis_w = {
                get: (key, callback) => {
                    redis.get(key, callback);
                },

                set: (key, value, callback) => {
                    redis.set(key, value, callback);
                }
            };

            // Add them all to the bridge
            config.accessories
                .map(info => require(info.package)(hap, mqttClient, info, redis_w))
                .forEach(accessory => bridge.addBridgedAccessory(accessory));

            bridge
                .publish({
                    port: targetPort++,
                    username: bridge.username,
                    pincode: bridge.pincode,
                    category: Accessory.Categories.BRIDGE
                });

            if (mongoUrl) {
                MongoClient.connect(mongoUrl, (err, db) => {
                    if (err)
                        throw err;
                    console.log(`Connected to ${mongoUrl}`);

                    mqttClient.subscribe('#');

                    storage = db.collection('events');
                });
            }

        });
    })
    .on('error', console.error)
    .on('message', (topic, message) => {
        console.log("RECEIVED:", topic, message.toString(), '\n\n');

        let parts = topic.split('/');
        let state = parts.pop();
        let device = parts.join('/');
        let msg = null;

        try {
            msg = JSON.parse(message.toString());
        } catch (e) {
            return console.error('Parse error', e);
        }
        storage.insert({
            timestamp: new Date().getTime(),
            device: device,
            state: state,
            topic: topic,
            message: msg,
            raw: message.toString()
        }, (err) => {
            if (err) console.error(err);
        })
    });
