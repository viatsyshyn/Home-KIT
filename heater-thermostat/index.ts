import {inherits} from 'util';

interface IConfig {
    microclimateMqttId: string;
    heaterMqttId: string;
}

module.exports = (hap, mqtt, info) => {

    const uuid = hap.uuid;
    const Accessory = hap.Accessory;
    const Service = hap.Service;
    const Characteristic = hap.Characteristic;

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    let controllerUUID = uuid.generate(`hap-nodejs:accessories:heater-thermostat:${info.mqttId}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    let controller = new Accessory('Thermostat', controllerUUID);

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    controller.addService(Service.Thermostat);

    const config: IConfig = info.config;

    const sub_topic = `${config.microclimateMqttId}/reported`;
    const pub_topic = `${config.heaterMqttId}/desired`;

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('change', event => {
            const currentTemp = event.newValue,
                targetTemp = controller
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.TargetTemperature)
                    .value;

            if (currentTemp < targetTemp - .5) {
                mqtt.publish(pub_topic, JSON.stringify({
                    active: true
                }));

            if (currentTemp > targetTemp + .5) {
                mqtt.publish(pub_topic, JSON.stringify({
                    active: false
                }));
        });

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
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(msg.temperature);

                controller
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(msg.humidity);
            }
        });

    return controller;
}