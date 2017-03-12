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

    const item_id = info.mqttId;

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    let controllerUUID = uuid.generate(`hap-nodejs:accessories:heater-thermostat:${item_id}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    let controller = new Accessory(`Thermostat (${item_id})`, controllerUUID);

    controller
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "SmartHome LLC")
        .setCharacteristic(Characteristic.Model, "Room Thermostat Prototype A")
        .setCharacteristic(Characteristic.SerialNumber, "RTS-PTA-0.0.1");

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    controller.addService(Service.Thermostat);

    const config: IConfig = info.config;

    const microclimate_sub_topic = `${config.microclimateMqttId}/reported`;
    const heater_pub_topic = `${config.heaterMqttId}/desired`;
    const heater_sub_topic = `${config.heaterMqttId}/reported`;

    let heater_target_state = null;

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('change', event => {
            changeHeaterState(event);
        });

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetTemperature)
        .on('change', event => {
            changeHeaterState(event);
        });

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('change', event => {
            changeHeaterState(event);
        });

    function changeHeaterState(event) {
        const currentTemp = controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .value;

        const targetTemp = controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.TargetTemperature)
                .value;

        const targetMode = controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .value;

        const currentState = controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                .value;

        switch (targetMode) {
            case Characteristic.TargetHeatingCoolingState.AUTO:
                if (currentTemp < targetTemp - .25) {
                    mqtt.publish(heater_pub_topic, JSON.stringify({
                        active: heater_target_state = true
                    }));
                }

                if (currentTemp > targetTemp + .25) {
                    mqtt.publish(heater_pub_topic, JSON.stringify({
                        active: heater_target_state = false
                    }));
                }

                break;

            case Characteristic.TargetHeatingCoolingState.HEAT:
                mqtt.publish(heater_pub_topic, JSON.stringify({
                    active: heater_target_state = true
                }));
                break;

            case Characteristic.TargetHeatingCoolingState.COOL:
            case Characteristic.TargetHeatingCoolingState.OFF:
            default:
                
                mqtt.publish(heater_pub_topic, JSON.stringify({
                    active: heater_target_state = false
                }));
                break;
        }
    }

    let timer_ = setTimeout(() => controller.updateReachability(true), 50);

    mqtt.subscribe(microclimate_sub_topic)
        .subscribe(heater_sub_topic)
        .on('message', (topic, message) => {
            let msg = null;

            try {
                msg = JSON.parse(message.toString());
            } catch (e) {
                return console.error('Parse error', e);
            }

            if (msg && microclimate_sub_topic === topic) {
                controller
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(msg.temperature);

                controller
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(msg.humidity);
            }

            if (msg && heater_sub_topic === topic
                && typeof msg.active === 'boolean') {

                controller
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                    .updateValue(msg.active
                        ? Characteristic.CurrentHeaterCoolerState.HEATING
                        : Characteristic.CurrentHeaterCoolerState.IDLE);

            }

            if (msg && heater_sub_topic === topic
                && typeof msg.active === 'boolean'
                && heater_target_state != null
                && heater_target_state !== msg.active) {

                mqtt.publish(heater_pub_topic, JSON.stringify({
                    active: heater_target_state
                }));

            }
        });

    return controller;
}