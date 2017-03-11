module.exports = (hap, mqtt, info) =>
{
    const uuid = hap.uuid;
    const Accessory = hap.Accessory;
    const Service = hap.Service;
    const Characteristic = hap.Characteristic;

    const item_id = info.mqttId;

    // Generate a consistent UUID for our Temperature Sensor Accessory that will remain the same
    // even when restarting our server. We use the `uuid.generate` helper function to create
    // a deterministic UUID based on an arbitrary "namespace" and the string "temperature-sensor".
    const sensorUUID = uuid.generate(`hap-nodejs:accessories:microclimate-sensor:${item_id}`);

    // This is the Accessory that we'll return to HAP-NodeJS that represents our fake lock.
    const sensor = new Accessory(`Microclimate (${item_id})`, sensorUUID);

    sensor
        .getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.Manufacturer, "SmartHome LLC")
        .setCharacteristic(Characteristic.Model, "Microclimate Sensors Prototype A")
        .setCharacteristic(Characteristic.SerialNumber, "MCS-PTA0.0.1");

    // Add the actual TemperatureSensor Service.
    // We can see the complete list of Services and Characteristics in `lib/gen/HomeKitTypes.js`
    sensor.addService(Service.TemperatureSensor);
    sensor.addService(Service.HumiditySensor);

    const sub_topic = `${item_id}/reported`;

    let timer_ = setTimeout(() => sensor.updateReachability(false), 50);

    mqtt.subscribe(sub_topic)
        .on('message', (topic, message) => {
            let msg = null;

            if (topic.substr(0, item_id.length) === item_id) {
                sensor.updateReachability(true);

                timer_ && clearTimeout(timer_);
                timer_ = setTimeout(() => sensor.updateReachability(false), 150000);
            }

            try {
                msg = JSON.parse(message.toString());
            } catch (e) {
                return console.error('Parse error', e);
            }

            if (msg && sub_topic === topic) {
                sensor
                    .getService(Service.TemperatureSensor)
                    .getCharacteristic(Characteristic.CurrentTemperature)
                    .updateValue(msg.temperature);

                sensor
                    .getService(Service.HumiditySensor)
                    .getCharacteristic(Characteristic.CurrentRelativeHumidity)
                    .updateValue(msg.humidity);
            }
        });

    return sensor;
};