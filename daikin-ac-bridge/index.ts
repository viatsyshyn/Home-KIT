import {inherits} from 'util';
import * as scheduler from 'node-schedule';
import * as bridge from './doc2mqtt';

interface IConfig {
    host: string;
    microclimateMqttId: string;
}

module.exports = (hap, mqtt, info, redis) => {

    const uuid = hap.uuid;
    const Accessory = hap.Accessory;
    const Service = hap.Service;
    const Characteristic = hap.Characteristic;

    const item_id = info.mqttId;

    const logger = hap.loggerFactory(item_id);

    const config: IConfig = info.config;

    const ac_sub_topic = `${item_id}/reported`;
    const microclimate_sub_topic = `${config.microclimateMqttId}/reported`;

    // Setup Diakin Online Controller to MQTT bridge
    bridge(logger, mqtt, item_id, config.host);

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
            redis.get(TargetTemperature_KEY, (err, value) => {
                callback(err, Math.max(10, parseInt(value, 10)))
            });
        })
        .on('set', (newValue, callback) => {
            redis.set(TargetTemperature_KEY, newValue, callback);
        })
        .on('change', event => {
            changeHeaterState(event);
        });

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('get', (callback) => {
            redis.get(TargetHeatingCoolingState_KEY, (err, value) => {
                callback(err, parseInt(value, 10))
            });
        })
        .on('set', (newValue, callback) => {
            redis.set(TargetHeatingCoolingState_KEY, newValue, callback);
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

    mqtt.subscribe(ac_sub_topic)
        .subscribe(microclimate_sub_topic)
        .on('message', (topic, message) => {
            let msg = null;

            try {
                msg = JSON.parse(message.toString());
            } catch (e) {
                return logger.error('Parse error', e);
            }

            if (msg && ac_sub_topic === topic) {
                controller.updateReachability(true);
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
        });

    return controller;
}