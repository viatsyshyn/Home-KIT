import {inherits} from 'util';
import * as scheduler from 'node-schedule';

interface IConfig {
    microclimateMqttId: string;
    heaterMqttId: string;
}

module.exports = (hap, mqtt, info, redis) => {

    const uuid = hap.uuid;
    const Accessory = hap.Accessory;
    const Service = hap.Service;
    const Characteristic = hap.Characteristic;

    const item_id = info.mqttId;

    const logger = hap.loggerFactory(item_id);

    const schedule = require('./config.json');

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

    const TargetHeatingCoolingState_KEY = `${item_id}::${Characteristic.TargetHeatingCoolingState.UUID}`;
    const TargetTemperature_KEY = `${item_id}::${Characteristic.TargetTemperature.UUID}`;
    const HeatingThresholdTemperature_KEY = `${item_id}::${Characteristic.HeatingThresholdTemperature.UUID}`;

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

    controller
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.HeatingThresholdTemperature)
        .on('get', (callback) => {
            redis.get(HeatingThresholdTemperature_KEY, (err, value) => {
                callback(err, value < .1 ? .2 : value)
            });
        })
        .on('set', (newValue, callback) => {
            redis.set(HeatingThresholdTemperature_KEY, newValue, callback);
        })
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

        const threshold = controller
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .value;

        switch (targetMode) {
            case Characteristic.TargetHeatingCoolingState.HEAT:
            case Characteristic.TargetHeatingCoolingState.AUTO:
                if (currentTemp < (targetTemp - threshold)) {
                    mqtt.publish(heater_pub_topic, JSON.stringify({
                        active: heater_target_state = true
                    }));
                }

                if (currentTemp > (targetTemp + threshold)) {
                    mqtt.publish(heater_pub_topic, JSON.stringify({
                        active: heater_target_state = false
                    }));
                }

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

    let timer_ = setTimeout(() => controller.updateReachability(true), 500);

    Object.keys(schedule).forEach(job => {
        let temperature = schedule[job];
        scheduler.scheduleJob(job, () => {
            changeTemperatureByScheduler(temperature)
        })
    });

    mqtt.subscribe(microclimate_sub_topic)
        .subscribe(heater_sub_topic)
        .on('message', (topic, message) => {
            let msg = null;

            try {
                msg = JSON.parse(message.toString());
            } catch (e) {
                return logger.error('Parse error', e);
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