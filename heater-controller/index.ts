import {inherits} from 'util';

module.exports = (hap, mqtt, info) => {

    const uuid = hap.uuid;
    const Accessory = hap.Accessory;
    const Service = hap.Service;
    const Characteristic = hap.Characteristic;

    const item_id = info.mqttId;

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    let controllerUUID = uuid.generate(`hap-nodejs:accessories:heater-controller:${item_id}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    let controller = new Accessory(`Heater (${item_id})`, controllerUUID);

    controller
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "SmartHome LLC")
        .setCharacteristic(Characteristic.Model, "Heater Controller Prototype A")
        .setCharacteristic(Characteristic.SerialNumber, "HTC-PTA-0.0.1");

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    const service = controller.addService(Service.HeaterCooler, "Heater");

    const sub_topic = `${item_id}/reported`;
    const pub_topic = `${item_id}/desired`;

    service
        .getCharacteristic(Characteristic.Active)
        .on('change', event => {
            mqtt.publish(pub_topic, JSON.stringify({
                active: event.newValue == Characteristic.Active.ACTIVE
            }));
        });

    let timer_ = setTimeout(() => controller.updateReachability(false), 50);

    mqtt.subscribe(sub_topic)
        .on('message', (topic, message) => {
            let msg = null;

            if (topic.substr(0, item_id.length) === item_id) {
                controller.updateReachability(true);

                timer_ && clearTimeout(timer_);
                timer_ = setTimeout(() => controller.updateReachability(false), 150000);
            }

            try {
                msg = JSON.parse(message.toString());
            } catch (e) {
                return console.error('Parse error', e);
            }

            if (msg && sub_topic === topic) {
                if (typeof msg.active === 'boolean') {
                    service
                        .getCharacteristic(Characteristic.Active)
                        .updateValue(msg.active
                            ? Characteristic.Active.ACTIVE
                            : Characteristic.Active.INACTIVE);

                }

                if (Array.isArray(msg.values) && msg.values.length == 2) {
                    msg.values.sort((a,b) => b-a);

                    service
                        .getCharacteristic(Characteristic.CurrentTemperature)
                        .updateValue((parseFloat(msg.values[0]) + parseFloat(msg.values[1])) / 2);

                    service
                        .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
                        .updateValue(Math.abs(msg.values[0] - msg.values[1]) > .75
                            ? Characteristic.CurrentHeaterCoolerState.HEATING
                            : Characteristic.CurrentHeaterCoolerState.IDLE);
                }
            }
        });

    return controller;
};