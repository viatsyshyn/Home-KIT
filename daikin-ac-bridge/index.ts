import {inherits} from 'util';
import {IRuntime} from "../homekit-bridge/api/runtime";
import {IAccessory} from "../homekit-bridge/api/config";
import {doc2mqtt} from "./doc2mqtt";

interface IConfig {
    host: string;
    microclimateMqttId: string;
}

module.exports = (runtime: IRuntime, info: IAccessory) => {

    const uuid = runtime.uuid;
    const Accessory = runtime.Accessory;
    const Service = runtime.Service;
    const Characteristic = runtime.Characteristic;

    const item_id = info.id;

    const logger = runtime.getLogger(item_id);

    const config: IConfig = info.config;

    const ac_sub_topic = `${item_id}/reported`;
    const microclimate_sub_topic = `${config.microclimateMqttId}/reported`;

    // Setup Diakin Online Controller to MQTT bridge
    doc2mqtt(logger, runtime.pubsub, item_id, config.host);

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    let controllerUUID = uuid.generate(`hap-nodejs:accessories:daikin-ac-controller:${item_id}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    let controller = new Accessory(`Daikin A/C (${item_id})`, controllerUUID);

    controller
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "SmartHome LLC")
        .setCharacteristic(Characteristic.Model, "Daikin A/C Controller Prototype A")
        .setCharacteristic(Characteristic.SerialNumber, "DAC-PTA-0.0.1");

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    controller.addService(Service.HumidifierDehumidifier);
    controller.addService(Service.HeaterCooler);
    controller.addService(Service.Thermostat);

    const TargetHeatingCoolingState_KEY = `${item_id}::${Characteristic.TargetHeatingCoolingState.UUID}`;
    const TargetTemperature_KEY = `${item_id}::${Characteristic.TargetTemperature.UUID}`;

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetTemperature)
        .on('get', (callback) => {
            runtime.cache
                .get(TargetTemperature_KEY)
                .then(value => { callback(null, Math.max(10, parseInt(value, 10)))
                .catch(err => callback(err));
            });
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(TargetTemperature_KEY, newValue)
                .then(x => callback());
        })
        .on('change', event => {
            changeHeaterState(event);
        });

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('get', (callback) => {
            runtime.cache
                .get(TargetHeatingCoolingState_KEY)
                .then(value => { callback(null, parseInt(value, 10))
                .catch(err => callback(err));
            });
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(TargetHeatingCoolingState_KEY, newValue)
                .then(x => callback());
        })
        .on('change', event => {
            changeHeaterState(event);
        });

    function changeHeaterState(event) {
        const targetTemperature = controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.TargetTemperature)
                .value;

        const targetMode = controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .value;

        switch (targetMode) {
            case Characteristic.TargetHeatingCoolingState.HEAT:
            case Characteristic.TargetHeatingCoolingState.AUTO:
            case Characteristic.TargetHeatingCoolingState.COOL:
            case Characteristic.TargetHeatingCoolingState.OFF:
            default:
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

        logger.log('SCHEDULE applied', temperature);
    }

    let timer_ = setTimeout(() => controller.updateReachability(false), 17);

    /*Object.keys(schedule).forEach(job => {
        let temperature = schedule[job];
        scheduler.scheduleJob(job, () => {
            changeTemperatureByScheduler(temperature)
        })
    });*/

    runtime.pubsub
        .sub(ac_sub_topic, () => controller.updateReachability(true))
        .sub(microclimate_sub_topic, (msg) => {
            controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(msg.temperature);

            controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .updateValue(msg.humidity);
        })
        ;

    return controller;
};