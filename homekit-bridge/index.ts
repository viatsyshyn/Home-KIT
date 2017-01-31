import * as hap from 'hap-nodejs';
import * as process from 'process';
import * as mqtt from 'mqtt';
import * as fs from 'fs';
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

// Our Accessories will each have their own HAP server; we will assign ports sequentially
var targetPort = config.port || 51827;

// Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
// even when restarting our server. We use the `uuid.generate` helper function to create
// a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
var bridgeUUID = uuid.generate('hap-nodejs:accessories:homekit-dridge');

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
var bridge = new Accessory(config.name || 'HomeKitBridge', bridgeUUID);

// Add properties for publishing (in case we're using Core.js and not BridgedCore.js)
bridge.username = config.MAC;
bridge.pincode = config.PIN;

// Listen for bridge identification event
bridge.on('identify', (paired, callback) => {
    console.log("Node Bridge identify");
    callback(); // success
});

var signals = { 'SIGINT': 2, 'SIGTERM': 15 };
Object.keys(signals).forEach( signal =>
    process.on(signal, () => {
        console.info("Got %s, shutting down Homebridge...", signal);
        bridge.destroy();
        process.exit(128 + signals[signal]);
    }));

const mosquittoUrl = config.MQTT;
let storage = null;

const mqttClient = mqtt
    .connect(mosquittoUrl)
    .on('connect', () => {
        console.log(`Connected to ${mosquittoUrl}`);

        // Add them all to the bridge
        config.accessories
            .map(info => require(info.package)(hap, mqttClient, info))
            .forEach(accessory => bridge.addBridgedAccessory(accessory));

        bridge
            .publish({
                port: targetPort++,
                username: bridge.username,
                pincode: bridge.pincode,
                category: Accessory.Categories.BRIDGE
            });

        if (config.storage) {
            MongoClient.connect(config.storage, (err, db) => {
                if (err)
                    throw err;
                console.log(`Connected to ${config.storage}`);

                mqttClient.subscribe('#');

                storage = db.collection('events');
            });
        }
    })
    .on('error', console.error)
    .on('message', (topic, message) => {
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