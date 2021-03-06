import {IRuntime} from "../homekit-bridge/api/runtime";
import {IAccessory} from "../homekit-bridge/api/config";

module.exports = (runtime: IRuntime, info: IAccessory) =>
{
    const uuid = runtime.uuid;
    const Accessory = runtime.Accessory;
    const Service = runtime.Service;
    const Characteristic = runtime.Characteristic;

    const item_id = info.id;

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    const sensorUUID = uuid.generate(`hap-nodejs:accessories:microclimate-sensor:${item_id}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    const sensor = new Accessory(`Climate Sensors (${item_id})`, sensorUUID);

    sensor
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "SmartHome LLC")
        .setCharacteristic(Characteristic.Model, "Climate Sensors Prototype B")
        .setCharacteristic(Characteristic.SerialNumber, "MCS-PTB-0.0.1");

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    sensor.addService(Service.TemperatureSensor);
    sensor.addService(Service.HumiditySensor);
    sensor.addService(Service.AirQualitySensor);

    const sub_topic = `${item_id}/reported`;

    let timer_ = setTimeout(() => sensor.updateReachability(false), 50);

    runtime.pubsub
        /* Update reachbility */
        .sub(sub_topic, msg => {
            sensor.updateReachability(true);

            clearTimeout(timer_);
            timer_ = setTimeout(() => sensor.updateReachability(false), 150000);
        })
        /* track sensors */
        .sub(sub_topic, msg => {
            let zone_update: any = { by: item_id };
            if (msg.temperature != null && msg.temperature > -127) {
                sensor
                    .getService(Service.TemperatureSensor)
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(msg.temperature);

                zone_update.currentTemperature = msg.temperature;
            }

            if (msg.humidity != null && msg.humidity > 0) {
                sensor
                    .getService(Service.HumiditySensor)
                    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(msg.humidity);


                zone_update.currentHumidity = msg.humidity;
            }

            if (msg['harmful-gases'] != null) {
                sensor
                    .getService(Service.AirQualitySensor)
                    .getCharacteristic(Characteristic.AirQuality)
                    .updateValue(Math.ceil(msg['harmful-gases']));

                zone_update.currentAirQuality = Math.ceil(msg['harmful-gases']);
            }

            if (Object.keys(zone_update).length > 1) {
                info.zones.forEach(zone => {
                    runtime.pubsub.pub(`${zone}/climate`, zone_update);
                });
            }
        });

    return sensor;
};