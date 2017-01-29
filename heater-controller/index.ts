import {inherits} from 'util';

module.exports = (hap, mqtt, info) => {

    const uuid = hap.uuid;
    const Accessory = hap.Accessory;
    const Service = hap.Service;
    const Characteristic = hap.Characteristic;

    /**
     * Characteristic "Current In Temperature"
     */

    function CurrentInTemperature() {
        Characteristic.call(this, 'Current In Temperature', CurrentInTemperature.UUID);
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: Characteristic.Units.CELSIUS,
            maxValue: 127,
            minValue: -127,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    }

    inherits(CurrentInTemperature, Characteristic);

    CurrentInTemperature.UUID = uuid.generate('hap-nodejs:accessories:heater-controller:heater-service:in-temperature');

    /**
     * Characteristic "Current Out Temperature"
     */

    function CurrentOutTemperature() {
        Characteristic.call(this, 'Current Out Temperature', CurrentOutTemperature.UUID);
        this.setProps({
            format: Characteristic.Formats.FLOAT,
            unit: Characteristic.Units.CELSIUS,
            maxValue: 127,
            minValue: -127,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    }

    inherits(CurrentOutTemperature, Characteristic);

    CurrentOutTemperature.UUID = uuid.generate('hap-nodejs:accessories:heater-controller:heater-service:out-temperature');

    /**
     * Service "Heater"
     */

    function Heater(displayName, subtype) {
        Service.call(this, displayName, Heater.UUID, subtype);

        // Required Characteristics
        this.addCharacteristic(Characteristic.On)
            .updateValue(false);
        this.addCharacteristic(CurrentInTemperature);
        this.addCharacteristic(CurrentOutTemperature);

        // Optional Characteristics
        this.addOptionalCharacteristic(Characteristic.Name);
    }

    inherits(Heater, Service);

    const item_id = info.mqttId;

    Heater.UUID = uuid.generate(`hap-nodejs:accessories:heater-controller:heater-service`);

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    let controllerUUID = uuid.generate(`hap-nodejs:accessories:heater-controller:${item_id}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    let controller = new Accessory('Heater', controllerUUID);

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    controller.addService(Heater);

    const sub_topic = `${item_id}/reported`;

    mqtt.subscribe(sub_topic)
        .on('message', (topic, message) => {
            console.log("RECEIVED:", topic, message.toString(), '\n\n');
            let msg = null;

            try {
                msg = JSON.parse(message.toString());
            } catch (e) {
                return console.error('Parse error', e);
            }

            if (msg && sub_topic === topic) {
                controller
                    .getService(Heater)
                    .getCharacteristic(Characteristic.On)
                    .updateValue(msg.active);

                controller
                    .getService(Heater)
                    .getCharacteristic(CurrentInTemperature)
                    .updateValue(msg.values[0]);

                controller
                    .getService(Heater)
                    .getCharacteristic(CurrentOutTemperature)
                    .updateValue(msg.values[1]);
            }
        });

    return controller;
};