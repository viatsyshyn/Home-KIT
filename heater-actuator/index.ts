import {inherits} from 'util';
import {IRuntime} from "../homekit-bridge/api/runtime";
import {IAccessory} from "../homekit-bridge/api/config";

module.exports = (runtime: IRuntime, info: IAccessory) => {

    const uuid = runtime.uuid;
    const Accessory = runtime.Accessory;
    const Service = runtime.Service;
    const Characteristic = runtime.Characteristic;

    const item_id = info.id;

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    let controllerUUID = uuid.generate(`hap-nodejs:accessories:heater-controller:${item_id}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    let actuator = new Accessory(`Heater (${item_id})`, controllerUUID);

    actuator
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "SmartHome LLC")
        .setCharacteristic(Characteristic.Model, "Heater Controller Prototype A")
        .setCharacteristic(Characteristic.SerialNumber, "HTC-PTA-0.0.1");

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    const service = actuator.addService(Service.HeaterCooler, "Heater");

    actuator
        .addService(Service.Outlet)
        .setCharacteristic(Characteristic.OutletInUse, true);

    actuator.addService(Service.TemperatureSensor);

    const sub_topic = `${item_id}/reported`;
    const pub_topic = `${item_id}/desired`;

    service
        .getCharacteristic(Characteristic.Active)
        .on('change', event => {
            runtime.pubsub.pub(pub_topic, { active: event.newValue == Characteristic.Active.ACTIVE });
        });

    actuator
        .getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
        .on('change', event => {
            runtime.pubsub.pub(pub_topic, { active: event.newValue });
        });

    let timer_ = setTimeout(() => actuator.updateReachability(false), 50);

    runtime.pubsub
        .sub(sub_topic, msg => {
            actuator.updateReachability(true);

            timer_ && clearTimeout(timer_);
            timer_ = setTimeout(() => actuator.updateReachability(false), 150000);

            if (typeof msg.active === 'boolean') {
                service
                    .getCharacteristic(Characteristic.Active)
                    .updateValue(msg.active
                        ? Characteristic.Active.ACTIVE
                        : Characteristic.Active.INACTIVE);

                actuator
                    .getService(Service.Outlet)
                    .getCharacteristic(Characteristic.On)
                    .updateValue(msg.active);
            }

            if (Array.isArray(msg.values) && msg.values.length == 2) {
                let avg_temp = (parseFloat(msg.values[0]) + parseFloat(msg.values[1])) / 2;

                actuator
                    .getService(Service.TemperatureSensor)
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(avg_temp);

                service
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(avg_temp);

                let is_in_use = (msg.values[0] - msg.values[1]) > .75;

                service
                    .getCharacteristic(Characteristic.CurrentHeaterCoolerState)
                    .updateValue(is_in_use
                        ? Characteristic.CurrentHeaterCoolerState.HEATING
                        : Characteristic.CurrentHeaterCoolerState.IDLE);

                actuator
                    .getService(Service.Outlet)
                    .getCharacteristic(Characteristic.OutletInUse)
                    .updateValue(is_in_use);
            }
        });

    return actuator;
};