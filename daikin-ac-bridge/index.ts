import {inherits} from 'util';
import {IRuntime} from "../homekit-bridge/api/runtime";
import {IAccessory} from "../homekit-bridge/api/config";
import {doc2mqtt, AirConMode} from "./doc2mqtt";
import {IControlInfo} from "../../daikin-aircon-jslib/connector";

interface IConfig {
    host: string;
}

module.exports = (runtime: IRuntime, info: IAccessory) => {

    const uuid = runtime.uuid;
    const Accessory = runtime.Accessory;
    const Service = runtime.Service;
    const Characteristic = runtime.Characteristic;

    const item_id = info.id;

    if (info.zones.length != 1) {
        throw new Error(`Heater "${item_id}" should have exactly 1 zone`);
    }

    const logger = runtime.getLogger(item_id);

    const config: IConfig = info.config;

    const ac_sub_topic = `${item_id}/reported`;
    const ac_pub_topic = `${item_id}/desired`;
    const zone_heater_cooler_topic = `${info.zones[0]}/heater-cooler`;
    const zone_humidifier_dehumidifier_topic = `${info.zones[0]}/humidifier-dehumidifier`;
    const zone_climate_topic = `${info.zones[0]}/climate`;

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

    let timer_ = setTimeout(() => controller.updateReachability(false), 50);

    let heater_cooler_state = 0,
        humidifier_dehumidifier_state = 0,
        target_temperature = 0; // OFF

    function try_change_state() {
        let pow = heater_cooler_state != 0 || humidifier_dehumidifier_state != 0;
        let mode = AirConMode.AUTO;
        if (humidifier_dehumidifier_state < 0)
            mode = AirConMode.DRY;
        else if (heater_cooler_state != 0) {
            mode = heater_cooler_state < 0 ? AirConMode.COOL : AirConMode.HEAT;
        }

        runtime.pubsub
            .pub(ac_pub_topic, <IControlInfo>{
                pow: pow,
                mode: mode,
                stemp: target_temperature
            });
    }

    runtime.pubsub
        .sub(zone_humidifier_dehumidifier_topic, msg => {
            if (msg.state != null) {
                humidifier_dehumidifier_state = msg.state;
                try_change_state();
            }
        })
        .sub(zone_heater_cooler_topic, msg => {
            if (msg.state != null) {
                heater_cooler_state = msg.state;
                try_change_state();
            }
        })
        .sub(ac_sub_topic, () => {
            controller.updateReachability(true);
            timer_ && clearTimeout(timer_);
            timer_ = setTimeout(() => controller.updateReachability(false), 150000);
        })
        .sub(zone_climate_topic, (msg) => {
            msg.currentTemperature != null && controller
                .getService(Service.HeaterCooler)
                .getCharacteristic(Characteristic.CurrentTemperature)
                .updateValue(msg.currentTemperature);

            if (msg.targetTemperature != null) {
                target_temperature = msg.targetTemperature;
            }
            /*msg.targetTemperature != null && controller
                .getService(Service.HeaterCooler)
                .getCharacteristic(Characteristic.TargetTemperature)
                .updateValue(msg.targetTemperature);
            */
            msg.currentHumidity != null && controller
                .getService(Service.HumidifierDehumidifier)
                .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                .updateValue(msg.currentHumidity);

            /*msg.targetHumidity != null && controller
                .getService(Service.HumidifierDehumidifier)
                .getCharacteristic(Characteristic.TargetRelativeHumidity)
                .updateValue(msg.targetHumidity);
            */
        });

    return controller;
};