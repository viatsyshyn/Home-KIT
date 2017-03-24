import {inherits} from 'util';
import * as scheduler from 'node-schedule';
import {IRuntime} from "../homekit-bridge/api/runtime";
import {IAccessory} from "../homekit-bridge/api/config";

interface IConfig {
    heaterSchedule: Map<string, number>;
    coolerSchedule: Map<string, number>;
}

module.exports = (runtime: IRuntime, info: IAccessory) => {

    const uuid = runtime.uuid;
    const Accessory = runtime.Accessory;
    const Service = runtime.Service;
    const Characteristic = runtime.Characteristic;

    const item_id = info.id;

    if (info.zones.length != 1) {
        throw new Error(`Thermostat "${item_id}" should have exactly 1 zone`);
    }

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    let controllerUUID = uuid.generate(`hap-nodejs:accessories:heater-thermostat:${item_id}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    let thermostat = new Accessory(`Thermostat (${item_id})`, controllerUUID);

    thermostat
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "SmartHome LLC")
        .setCharacteristic(Characteristic.Model, "Room Thermostat Prototype A")
        .setCharacteristic(Characteristic.SerialNumber, "RTS-PTA-0.0.1");

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    thermostat.addService(Service.Thermostat);
    thermostat.addService(Service.Outlet);

    const config: IConfig = info.config;

    const Schedule_On_KEY = `${item_id}::schedule-enabled`;
    const TargetTemperature_KEY = `${item_id}::${Characteristic.TargetTemperature.UUID}`;
    const TargetRelativeHumidity_KEY = `${item_id}::${Characteristic.TargetRelativeHumidity.UUID}`;
    const TargetHeatingCoolingState_KEY = `${item_id}::${Characteristic.TargetHeatingCoolingState.UUID}`;
    const HeatingThresholdTemperature_KEY = `${item_id}::${Characteristic.HeatingThresholdTemperature.UUID}`;
    const CoolingThresholdTemperature_KEY = `${item_id}::${Characteristic.CoolingThresholdTemperature.UUID}`;

    thermostat
        .getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
        .on('get', (callback) => {
            runtime.cache
                .get(Schedule_On_KEY)
                .then(value => callback(null, value)
                .catch(err => callback(err));
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(Schedule_On_KEY, newValue)
                .then(x => callback());
        });

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('change', changeHeaterCoolerState);

    thermostat
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
        .on('change', changeHeaterCoolerState)
        .on('change', (event) => {
            runtime.pubsub.pub(zone_climate_topic, {
                by: item_id,
                targetTemperature: event.newValue
            })
        });

    thermostat
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
        .on('change', changeHeaterCoolerState);

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.HeatingThresholdTemperature)
        .on('get', (callback) => {
            runtime.cache
                .get(HeatingThresholdTemperature_KEY)
                .then(value => callback(null, Math.max(.25, parseFloat(value))))
                .catch(err => callback(err));
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(HeatingThresholdTemperature_KEY, newValue)
                .then(x => callback());
        })
        .on('change', changeHeaterCoolerState);

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CoolingThresholdTemperature)
        .on('get', (callback) => {
            runtime.cache
                .get(CoolingThresholdTemperature_KEY)
                .then(value => callback(null, Math.max(1, parseFloat(value))))
                .catch(err => callback(err));
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(CoolingThresholdTemperature_KEY, newValue)
                .then(x => callback());
        })
        .on('change', changeHeaterCoolerState);

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetRelativeHumidity)
        .on('get', (callback) => {
            runtime.cache
                .get(TargetRelativeHumidity_KEY)
                .then(value => callback(null, parseInt(value || 50, 10)))
                .catch(err => callback(err));
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(TargetRelativeHumidity_KEY, newValue)
                .then(x => callback());
        })
        .on('change', changeHeaterCoolerState);

    const zone_humidifier_dehumidifier_topic = `${info.zones[0]}/humidifier-dehumidifier`;
    const zone_heater_cooler_topic = `${info.zones[0]}/heater-cooler`;
    const zone_climate_topic = `${info.zones[0]}/climate`;

    function changeHeaterCoolerState() {
        const currentTemp = thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .value;

        const targetTemp = thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.TargetTemperature)
                .value;

        const currentMode = thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                .value;

        const targetMode = thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .value;

        let heatingThreshold = thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .value;

        let coolingThreshold = thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .value;

        switch (targetMode) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                heatingThreshold = 10;
                coolingThreshold = 10;
                break;

            case Characteristic.TargetHeatingCoolingState.AUTO:
                heatingThreshold = Math.max(coolingThreshold, heatingThreshold);
                coolingThreshold = heatingThreshold;
        }

        let state = null; // OFF
        switch(currentMode) {
            case Characteristic.CurrentHeatingCoolingState.OFF:
                state = (currentTemp < (targetTemp - heatingThreshold)) ? +1 : // HEAT
                        (currentTemp > (targetTemp + coolingThreshold)) ? -1 : // COOL
                        0;
                break;

            case Characteristic.CurrentHeatingCoolingState.HEAT:
                state = (currentTemp > (targetTemp + heatingThreshold)) ? 0 : null;
                break;

            case Characteristic.CurrentHeatingCoolingState.COOL:
                state = (currentTemp < (targetTemp - coolingThreshold)) ? 0 : null;
                break;
        }

        if (state != null)
            runtime.pubsub.pub(zone_heater_cooler_topic, { state: state });
    }

    function changeTemperatureByScheduler(temperature, appliesToMode) {
        const targetMode = thermostat
            .getService(Service.Outlet)
            .getCharacteristic(Characteristic.On)
            .value;

        if (targetMode !== appliesToMode) {
            return;
        }

        thermostat
            .getService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetTemperature)
            .setValue(temperature);
    }

    setTimeout(() => thermostat.updateReachability(true), 500);

    Object.keys(config.heaterSchedule).forEach(job => {
        let temperature = config.heaterSchedule[job];
        scheduler.scheduleJob(job, () => {
            changeTemperatureByScheduler(temperature, Characteristic.TargetHeatingCoolingState.HEAT)
        });
    });

    Object.keys(config.coolerSchedule).forEach(job => {
        let temperature = config.coolerSchedule[job];
        scheduler.scheduleJob(job, () => {
            changeTemperatureByScheduler(temperature, Characteristic.TargetHeatingCoolingState.COOL)
        });
    });

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
        .on('change', changeHumidifierDehumidifierState);

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetRelativeHumidity)
        .on('change', changeHumidifierDehumidifierState);

    function changeHumidifierDehumidifierState() {
        const currentHumidity = thermostat
            .getService(Service.Thermostat)
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .value;

        const targetHumidity = thermostat
            .getService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetRelativeHumidity)
            .value;

        const threshold = 10;

        let state = null;
        if (currentHumidity > (targetHumidity + threshold)) {
            state = -1;
        }

        if (currentHumidity < (targetHumidity - threshold)) {
            state = 1;
        }

        if (state != null)
            runtime.pubsub.pub(zone_humidifier_dehumidifier_topic, { state: state });
    }

    runtime.pubsub
        .sub(zone_climate_topic, msg => {
            msg.currentTemperature != null && thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(msg.currentTemperature);

            msg.currentHumidity != null && thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .updateValue(msg.currentHumidity);
        })
        .sub(zone_heater_cooler_topic, msg => {
            msg.state != null && thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                .updateValue(msg.state > 0 ? Characteristic.CurrentHeatingCoolingState.HEAT :
                             msg.state < 0 ? Characteristic.CurrentHeatingCoolingState.COOL
                                           : Characteristic.CurrentHeatingCoolingState.OFF);
        });

    return thermostat;
};