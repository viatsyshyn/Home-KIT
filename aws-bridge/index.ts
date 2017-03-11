import * as awsIot from 'aws-iot-device-sdk';
import * as mqtt from 'mqtt';
import * as path from 'path';
import * as fs from 'fs';
import {
    IConfig,
    IDevice
} from 'config.d.ts';

const config = JSON.parse(fs.readFileSync('./config.json'));

let root = path.join(__dirname, config.root);
if (!fs.existsSync(root)) {
    console.log('The root\'s key didn\'t found');
    process.exit();
}

const things: Map<string, mixed> = {};

const mosquittoUrl = config.mqtt;

console.log(`Connecting to '${mosquittoUrl}' ...`);
const clientMosquitto = mqtt
    .connect(mosquittoUrl)
    .on('connect', () => {
        console.log(`Connected to ${mosquittoUrl}`);

        for(let key of Object.keys(config.devices)) {
            let device: IDevice = config.devices[key];

            let privKey = path.join(__dirname, device.privKey);
            let cert = path.join(__dirname, device.cert);

            if (!fs.existsSync(privKey) || !fs.existsSync(cert)) {
                console.error(`Thing's ("${key}") key/keys wasn't found. (privKey "${privKey}", cert "${cert}"`);
                process.exit();
            }

            let thing = awsIot
                .thingShadow({
                    keyPath: privKey,
                    certPath: cert,
                    caPath: root,
                    clientId: key,
                    region: config.region
                })
                .on('connect', () => {
                    thing.register(key);
                    console.log(`${key} connected to AWS`);

                    clientMosquitto.subscribe(device.subTopic);
                })
                .on('foreignStateChange', (thingName, operation, stateObject) => {
                    console.log('REMOTE', thingName, operation, JSON.stringify(stateObject), "\n\n");
                    clientMosquitto.publish(device.pubTopic, JSON.stringify(stateObject.state.desired));
                });

            things[key] = thing;
        }
    })
    .on('message', (topic, message) => {
        console.log("RECEIVED:", topic,  message.toString(), '\n\n');

        let msg = {};

        try {
            msg = JSON.parse(message.toString());
        } catch (e) {
            return console.log('Received message parsing error', e);
        }

        for(let key of Object.keys(config.devices)) {
            if (topic === config.devices[key].subTopic) {
                // console.log('Updating', key, topic, msg, 'sent!');

                return things[key].update(key, {
                    state: {
                        reported: msg
                    }
                });
            }
        }
    })
    .on('error', console.error);
