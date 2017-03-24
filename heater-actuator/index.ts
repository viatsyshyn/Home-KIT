import {inherits} from 'util';
import {IRuntime} from "../homekit-bridge/api/runtime";
import {IAccessory} from "../homekit-bridge/api/config";

module.exports = (runtime: IRuntime, info: IAccessory) => {

    const uuid = runtime.uuid;
    const Accessory = runtime.Accessory;
    const Service = runtime.Service;
    const Characteristic = runtime.Characteristic;

    const item_id = info.id;

    if (info.zones.length != 1) {
        throw new Error(`Heater "${item_id}" should have exactly 1 zone`);
    }

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

    actuator.addService(Service.Outlet);
    actuator.addService(Service.TemperatureSensor);

    const On_KEY = `${item_id}::${Characteristic.On.UUID}`;
    const sub_topic = `${item_id}/reported`;
    const pub_topic = `${item_id}/desired`;
    const heater_cooler_topic = `${info.zones[0]}/heater-cooler`;

    actuator
        .getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
        .on('get', (callback) => {
            runtime.cache
                .get(On_KEY)
                .then(value => callback(null, Math.max(10, parseInt(value, 10))))
                .catch(err => callback(err));
        })
        .on('set', (newValue, callback) => {
            runtime.cache
                .set(On_KEY, newValue)
                .then(x => callback());
        })
        .on('change', event => {
            runtime.pubsub.pub(pub_topic, { active: event.newValue });
        });

    let timer_ = setTimeout(() => actuator.updateReachability(false), 50);

    runtime.pubsub
        .sub(heater_cooler_topic, msg => {
            msg.state != null && actuator
                .getService(Service.Outlet)
                .getCharacteristic(Characteristic.On)
                .setValue(msg.state > 0);
        })
        .sub(sub_topic, msg => {
            actuator.updateReachability(true);

            timer_ && clearTimeout(timer_);
            timer_ = setTimeout(() => actuator.updateReachability(false), 150000);

            if (typeof msg.active === 'boolean') {
                const currentState = actuator
                    .getService(Service.Outlet)
                    .getCharacteristic(Characteristic.On)
                    .value;

                if (msg.active !== currentState) {
                    runtime.pubsub.pub(pub_topic, { active: currentState });
                }
            }

            if (Array.isArray(msg.values) && msg.values.length) {
                let avg_temp = msg.values.reduce((a, x) => a + parseFloat(x), 0) / msg.values.length;

                actuator
                    .getService(Service.TemperatureSensor)
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(avg_temp);

                msg.values.length == 2 && actuator
                    .getService(Service.Outlet)
                    .getCharacteristic(Characteristic.OutletInUse)
                    .updateValue((msg.values[0] - msg.values[1]) > .75);
            }
        });

    return actuator;
};