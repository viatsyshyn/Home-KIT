import * as dateFormat from "dateformat";

export function home(db) {
    return function (req, res) {

        const date_now = new Date (Date.now());
        const date_old = new Date (Date.now() - 86400000);
        const start = new Date(req.query.start || date_now);
        const end = new Date(req.query.end || date_old);

        const x = db.getTemperatureHumidity(start, end, "livingroom-microclimate");
        const y = db.getTemperatureInOut(start, end, "livingroom-heater");
        const z = db.getDeviceOnOff(start, end, "livingroom-heater");
        const v = db.getZoneState(start, end, "livingroom");
        const r = db.getAirConditioning(start, end, "livingroom-ac");

        Promise.all([x,y,z,v,r]).then(result => {

            let ttds: Array = result[1].concat(result[2]);
            ttds.sort(function(a, b){return a.timestamp-b.timestamp});

            let currentState = null;
            ttds.reduce((c, z: any) => {
                if (z.temperatureIn == null && z.active !== undefined) {
                    currentState = z.active;
                } else {
                    z.active = currentState;
                    c.push(z);
                }

                return c;
            }, []);

            res.render('index', {
                start: dateFormat(start, "yyyy-mm-dd'T'HH:mm"),
                end: dateFormat(end, "yyyy-mm-dd'T'HH:mm"),
                graph1: result[0],
                graph2: result[1],
                graph3: result[3],
                graph4: result[4]
            });
        });
    };
}