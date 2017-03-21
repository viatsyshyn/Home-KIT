export function home(db) {
    return function (req, res) {
        const start = new Date(req.query.start || '2017-03-11');
        const end = new Date(req.query.end || '2017-03-15');

        const x = db.getTemperatureHumidity(start, end, "livingroom-microclimate");
        const y = db.getTemperatureInOut(start, end, "livingroom-heater");
        const z = db.getDeviceOnOff(start, end, "livingroom-heater");

        Promise.all([x,y,z]).then(result => {

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
                start: start,
                end: end,
                graph1: result[0],
                graph2: result[1]
            });
        });
    };
}