import {IHAP} from "../api/hap";

import * as hap_node from 'hap-nodejs';
import * as process from 'process';
import {IConfig} from "../api/config";

export const hap: IHAP = hap_node;

// Initialize our storage system
hap_node.init();

const uuid = hap.uuid;
const Accessory = hap.Accessory;
const Service = hap.Service;
const Characteristic = hap.Characteristic;

// This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
export function BridgeFactory(config: IConfig, accessories: Array<Accessory>) {

    // Our Accessories will each have their own HAP server; we will assign ports sequentially
    let targetPort = config.port || 51827;
    let name = config.name || 'HomeKitBridge';

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    const bridgeUUID = uuid.generate('hap-nodejs:accessories:homekit-bridge:' + name);

    const bridge = new Accessory(name, bridgeUUID);

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
        callback(); // success
    });

    // Add them all to the bridge
    accessories.forEach(accessory => bridge.addBridgedAccessory(accessory));

    bridge
        .publish({
            port: targetPort,
            username: bridge.username,
            pincode: bridge.pincode,
            category: Accessory.Categories.BRIDGE
        });

    return bridge;
}