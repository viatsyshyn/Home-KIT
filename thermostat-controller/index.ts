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
        .setCharacteristic(Characteristic.Model, "Room Thermostat Prototype B")
        .setCharacteristic(Characteristic.SerialNumber, "RTS-PTB-0.0.1");

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    thermostat.addService(Service.Thermostat);
    thermostat.addService(Service.Outlet);

    const config: IConfig = info.config;

    const Schedule_On_KEY = `${item_id}::schedule-enabled`;
    const TargetTemperature_KEY = `${item_id}::target-temperature`;
    const TargetRelativeHumidity_KEY = `${item_id}::target-relative-humidity`;
    const TargetHeatingCoolingState_KEY = `${item_id}::target-heating-cooling-state`;
    const HeatingThresholdTemperature_KEY = `${item_id}::heating-threshold-temperature`;
    const CoolingThresholdTemperature_KEY = `${item_id}::cooling-threshold-temperature`;

    function read(name: string, type: string, def: any) {
        return callback =>
            runtime.cache.get(name)
                .then(value => {
                    if (value == null)
                        value = def;

                    switch (type) {
                        case 'int':     value = parseInt(value, 10); break;
                        case 'float':   value = parseFloat(value); break;
                        case 'bool':    value = !!value; break;
                    }

                    callback(null, value)
                })
                .catch(err => callback(err))
    }

    function write(name: string) {
        return (newValue, callback) =>
            runtime.cache.set(name, newValue)
                .then(x => callback(null))
                .catch(err => callback(err))
    }

    thermostat
        .getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
            .on('get', read(Schedule_On_KEY, 'int', 1))
            .on('set', write(Schedule_On_KEY));

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentTemperature)
            .on('change', changeHeaterCoolerState);

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.TargetTemperature)
            .on('get', read(TargetTemperature_KEY, 'float', 19))
            .on('set', write(TargetTemperature_KEY))
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
            .on('get', read(TargetHeatingCoolingState_KEY, 'int', Characteristic.TargetHeatingCoolingState.AUTO))
            .on('set', write(TargetHeatingCoolingState_KEY))
            .on('change', changeHeaterCoolerState);

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.HeatingThresholdTemperature)
            .on('get', read(HeatingThresholdTemperature_KEY, 'float', 18))
            .on('set', write(HeatingThresholdTemperature_KEY))
            .on('change', changeHeaterCoolerState)
            .on('change', event => {
                let coolingThreshold = thermostat
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                    .value;

                if (event.newValue + 2 > coolingThreshold) {
                    thermostat
                        .getService(Service.Thermostat)
                        .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                        .setValue(event.newValue + 2);
                }
            });

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CoolingThresholdTemperature)
            .on('get', read(CoolingThresholdTemperature_KEY, 'float', 23))
            .on('set', write(CoolingThresholdTemperature_KEY))
            .on('change', changeHeaterCoolerState)
            .on('change', event => {
                let heatingThreshold = thermostat
                    .getService(Service.Thermostat)
                    .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                    .value;

                if (event.newValue - 2 < heatingThreshold) {
                    thermostat
                        .getService(Service.Thermostat)
                        .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                        .setValue(event.newValue - 2);
                }
            });

    const zone_humidifier_dehumidifier_topic = `${info.zones[0]}/humidifier-dehumidifier`;
    const zone_heater_cooler_topic = `${info.zones[0]}/heater-cooler`;
    const zone_climate_topic = `${info.zones[0]}/climate`;

    function changeHeaterCoolerState() {
        const currentTemp = thermostat.getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .value;

        const storedTargetTemp = thermostat.getService(Service.Thermostat)
                .getCharacteristic(Characteristic.TargetTemperature)
                .value;

        const currentMode = thermostat.getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                .value;

        const targetMode = thermostat.getService(Service.Thermostat)
                .getCharacteristic(Characteristic.TargetHeatingCoolingState)
                .value;

        const heatingThreshold = thermostat.getService(Service.Thermostat)
                .getCharacteristic(Characteristic.HeatingThresholdTemperature)
                .value;

        const coolingThreshold = thermostat.getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CoolingThresholdTemperature)
                .value;

        let heatingDelta = .25;
        let coolingDelta = .5;

        let state = null; // OFF
        let targetTemp = storedTargetTemp;
        switch (targetMode) {
            case Characteristic.TargetHeatingCoolingState.OFF:
                heatingDelta = 100;
                coolingDelta = 100;

                // turn on heaters of less then 10C
                state = currentTemp < 10 ? +1: null;
                break;

            case Characteristic.TargetHeatingCoolingState.HEAT:
                coolingDelta = 100;
                break;

            case Characteristic.TargetHeatingCoolingState.COOL:
                heatingDelta = 100;
                break;

            case Characteristic.TargetHeatingCoolingState.AUTO:
                if (currentTemp < heatingThreshold - heatingDelta) {
                    targetTemp = heatingThreshold + 1;
                } else if (currentTemp > coolingThreshold + coolingDelta) {
                    targetTemp = coolingThreshold - 1;
                }

                if (targetTemp != storedTargetTemp) {
                    thermostat.getService(Service.Thermostat)
                        .getCharacteristic(Characteristic.TargetTemperature)
                        .setValue(targetTemp);
                }
        }

        switch(currentMode) {
            case Characteristic.CurrentHeatingCoolingState.OFF:
                state = (currentTemp < (targetTemp - heatingDelta)) ? +1 : // HEAT
                        (currentTemp > (targetTemp + coolingDelta)) ? -1 : // COOL
                        0;
                break;

            case Characteristic.CurrentHeatingCoolingState.HEAT:
                state = (currentTemp > (targetTemp + heatingDelta)) ? 0 : null;
                break;

            case Characteristic.CurrentHeatingCoolingState.COOL:
                state = (currentTemp < (targetTemp - coolingDelta)) ? 0 : null;
                break;
        }

        if (state != null) {
            runtime.pubsub.pub(zone_heater_cooler_topic, {state: state, by: item_id});
        }
    }

    function changeTemperatureByScheduler(temperature, appliesToMode) {
        const scheduleIsOn = thermostat.getService(Service.Outlet)
            .getCharacteristic(Characteristic.On)
            .value;

        const targetMode = thermostat.getService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetHeatingCoolingState)
            .value;

        if (!scheduleIsOn || targetMode != appliesToMode) {
            return;
        }

        thermostat.getService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetTemperature)
            .setValue(temperature);
    }

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
        .getCharacteristic(Characteristic.TargetRelativeHumidity)
            .on('get', read(TargetRelativeHumidity_KEY, 'int', 55))
            .on('set', write(TargetRelativeHumidity_KEY))
            .on('change', changeHumidifierDehumidifierState)
            .on('change', (event) => {
                runtime.pubsub.pub(zone_climate_topic, {
                    by: item_id,
                    targetHumidity: event.newValue
                })
            });

    thermostat
        .getService(Service.Thermostat)
        .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .on('change', changeHumidifierDehumidifierState);

    let currentHDState = 0;

    function changeHumidifierDehumidifierState() {
        const currentHumidity = thermostat.getService(Service.Thermostat)
            .getCharacteristic(Characteristic.CurrentRelativeHumidity)
            .value;

        const targetHumidity = thermostat.getService(Service.Thermostat)
            .getCharacteristic(Characteristic.TargetRelativeHumidity)
            .value;

        if (currentHumidity < 1 || targetHumidity < 1)
            return;

        const threshold = 5;

        let state = null;
        if (currentHDState != 0) {
            if (currentHumidity > (targetHumidity + threshold)) {
                state = -1;
            } else if (currentHumidity < (targetHumidity - threshold)) {
                state = +1;
            }
        } else if (currentHDState == +1 && currentHumidity > targetHumidity) {
            state = 0;
        } else if (currentHDState == -1 && currentHumidity < targetHumidity) {
            state = 0;
        }

        if (state != null) {
            runtime.pubsub.pub(zone_humidifier_dehumidifier_topic, {state: state, by: item_id});
        }
    }


    setTimeout(() => thermostat.updateReachability(true), 50);

    runtime.pubsub
        /* track temperature */
        .sub(zone_climate_topic, msg => {
            msg.currentTemperature != null && thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(msg.currentTemperature);
        })
        /* track humidity */
        .sub(zone_climate_topic, msg => {
            msg.currentHumidity != null && thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(msg.currentHumidity);
        })
        /* track H/C state */
        .sub(zone_heater_cooler_topic, msg => {
            msg.state != null && thermostat
                .getService(Service.Thermostat)
                .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
                    .updateValue(msg.state > 0 ? Characteristic.CurrentHeatingCoolingState.HEAT :
                                 msg.state < 0 ? Characteristic.CurrentHeatingCoolingState.COOL
                                               : Characteristic.CurrentHeatingCoolingState.OFF);
        })
        /* track H/C state */
        .sub(zone_humidifier_dehumidifier_topic, msg => {
            msg.state != null && (currentHDState = msg.state);
        });

    return thermostat;
};