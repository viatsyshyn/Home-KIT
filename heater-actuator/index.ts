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
        .setCharacteristic(Characteristic.Model, "Heater Actuator Prototype B")
        .setCharacteristic(Characteristic.SerialNumber, "HTA-PTB-0.0.1");

    actuator.addService(Service.Outlet);
    actuator.addService(Service.TemperatureSensor);

    const sub_topic = `${item_id}/reported`;
    const pub_topic = `${item_id}/desired`;
    const zone_heater_cooler_topic = `${info.zones[0]}/heater-cooler`;

    const On_KEY = `${item_id}::on`;
    actuator
        .getService(Service.Outlet)
        .getCharacteristic(Characteristic.On)
            .on('get', (callback) => runtime.cache.get(On_KEY)
                    .then(value => callback(null, !!parseInt(value || 1, 10))?1:0)
                    .catch(err => callback(err)))

            .on('set', (newValue, callback) => runtime.cache.set(On_KEY, newValue)
                    .then(x => callback())
                    .catch(err => callback(err)))

            .on('change', event => event.newValue != null
                    && runtime.pubsub.pub(pub_topic, {active: !!event.newValue}));


    let timer_ = setTimeout(() => actuator.updateReachability(false), 50);

    runtime.pubsub
        /* Update reachability */
        .sub(sub_topic, msg => {
            actuator.updateReachability(true);

            clearTimeout(timer_);
            timer_ = setTimeout(() => actuator.updateReachability(false), 150000);
        })
        /* Track zone H/C state */
        .sub(zone_heater_cooler_topic, msg => {
            msg.state != null && actuator
                .getService(Service.Outlet)
                .getCharacteristic(Characteristic.On)
                .setValue(msg.state > 0?1:0);
        })
        /* maintain intended status */
        .sub(sub_topic, msg => {
            if (msg.active == null)
                return;

            const currentState = actuator
                .getService(Service.Outlet)
                .getCharacteristic(Characteristic.On)
                .value;

            if (msg.active != currentState && currentState != null) {
                runtime.pubsub.pub(pub_topic, { active: !!currentState?1:0 });
            }

        })
        /* track temperatures */
        .sub(sub_topic, msg => {
            if (!Array.isArray(msg.values))
                return;

            let values = msg.values
                .map(x => parseFloat(x))
                .filter(x => !isNaN(x) && x != null && x > -127);

            if (!values.length)
                return;

            actuator
                .getService(Service.TemperatureSensor)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(values.reduce((a, x) => a + x, 0) / values.length);

            values.length > 1 && actuator
                .getService(Service.Outlet)
                .getCharacteristic(Characteristic.OutletInUse)
                .updateValue((values[0] - values[1]) > .75);
        });

    return actuator;
};