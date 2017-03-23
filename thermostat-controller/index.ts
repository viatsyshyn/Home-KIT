import {inherits} from 'util';
import * as scheduler from 'node-schedule';
import {IRuntime} from "../homekit-bridge/api/runtime";
import {IAccessory} from "../homekit-bridge/api/config";

interface IConfig {
    microclimateMqttId: string;
    heaterMqttId: string;
    schedule: any;
}

module.exports = (runtime: IRuntime, info: IAccessory) => {

    const uuid = runtime.uuid;
    const Accessory = runtime.Accessory;
    const Service = runtime.Service;
    const Characteristic = runtime.Characteristic;

    const item_id = info.id;

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
    const schedule = config.schedule;

    const TargetHeatingCoolingState_KEY = `${item_id}::${Characteristic.TargetHeatingCoolingState.UUID}`;
    const TargetTemperature_KEY = `${item_id}::${Characteristic.TargetTemperature.UUID}`;
    const HeatingThresholdTemperature_KEY = `${item_id}::${Characteristic.HeatingThresholdTemperature.UUID}`;

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('change', changeHeaterState);

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetTemperature)
        .on('get', (callback) => {
            runtime.cache
                .get(TargetTemperature_KEY)
                .then(value => callback(null, Math.max(10, parseInt(value, 10))))
                .catch(err => callback(err));
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(TargetTemperature_KEY, newValue)
                .then(x => callback());
        })
        .on('change', changeHeaterState);

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('get', (callback) => {
            runtime.cache
                .get(TargetHeatingCoolingState_KEY)
                .then(value => callback(null, parseInt(value, 10)))
                .catch(err => callback(err));
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(TargetHeatingCoolingState_KEY, newValue)
                .then(x => callback());
        })
        .on('change', changeHeaterState);


    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.HeatingThresholdTemperature)
        .on('get', (callback) => {
            runtime.cache
                .get(HeatingThresholdTemperature_KEY)
                .then(value => callback(null, parseInt(value, 10)))
                .catch(err => callback(err));
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(HeatingThresholdTemperature_KEY, newValue)
                .then(x => callback());
        })
        .on('change', changeHeaterState);

    function changeHeaterState() {
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

        const threshold = controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .value;

        switch (targetMode) {
            case Characteristic.TargetHeatingCoolingState.HEAT:
            case Characteristic.TargetHeatingCoolingState.AUTO:
                if (currentTemp < (targetTemp - threshold)) {
                    runtime.pubsub.pub(heater_pub_topic, { active: true });
                }

                if (currentTemp > (targetTemp + threshold)) {
                    runtime.pubsub.pub(heater_pub_topic, { active: false });
                }

                break;

            case Characteristic.TargetHeatingCoolingState.COOL:
            case Characteristic.TargetHeatingCoolingState.OFF:
            default:
                runtime.pubsub.pub(heater_pub_topic, { active: false });

                break;
        }
    }

    function changeTemperatureByScheduler(temperature) {
        const targetMode = controller
            .getService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .value;

        if (targetMode !== Characteristic.TargetHeatingCoolingState.AUTO) {
            return;
        }

        controller
            .getService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetTemperature)
            .setValue(temperature);
    }

    setTimeout(() => controller.updateReachability(true), 500);

    Object.keys(schedule).forEach(job => {
        let temperature = schedule[job];
        scheduler.scheduleJob(job, () => {
            changeTemperatureByScheduler(temperature)
        })
    });

    runtime.pubsub
        .sub(microclimate_sub_topic, msg => {
            controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(msg.temperature);

            controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .updateValue(msg.humidity);
        })
        .sub(heater_sub_topic, msg => {
            if (typeof msg.active === 'boolean') {
                controller
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                    .updateValue(msg.active
                        ? Characteristic.CurrentHeaterCoolerState.HEATING
                        : Characteristic.CurrentHeaterCoolerState.IDLE);
            }
        });

    return controller;
};