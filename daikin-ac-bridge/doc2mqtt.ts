import * as scheduler from 'node-schedule';

import {
    MODE,
    Aircon
} from 'daikin-aircon-jslib';

function track_changes(prev, current) {
    return Object
        .keys(current)
        .filter(key => prev[key] !== current[key])
        .reduce((result, key) => {
            result[key] = current[key];
            return result;
        }, {});
}

export default function DOC2MQTT(logger, mqtt, mqtt_id: string, ac_host: string) {

    const ac_reported_topic = `${mqtt_id}/reported`;

    const aircon = new Aircon(ac_host);

    scheduler.scheduleJob('00 * * * * *', () => {
        aircon.get_sensor_info()
            .then(x => {
                mqtt.publish(ac_reported_topic, x);
            })
            .catch(logger.error);
    });

    let prevState = {};
    scheduler.scheduleJob('15 * * * * *', () => {
        aircon.get_basic_info()
            .then(x => {
                const changes = track_changes(prevState, x);
                prevState = Object.assign({}, prevState, x);
                if (Object.keys(changes).length) {
                    mqtt.publish(ac_reported_topic, changes);
                }
            })
            .catch(logger.error);
    });

    scheduler.scheduleJob('30 * * * * *', () => {
        aircon.get_control_info()
            .then(x => {
                const changes = track_changes(prevState, x);
                prevState = Object.assign({}, prevState, x);
                if (Object.keys(changes).length) {
                    mqtt.publish(ac_reported_topic, changes);
                }
            })
            .catch(logger.error);
    });
}