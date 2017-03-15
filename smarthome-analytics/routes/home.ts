export function home(db) {
    return function (req, res) {
        const start = new Date(req.query.start || '2017-03-11');
        const end = new Date(req.query.end || '2017-03-15');

        const x = db.getTemperatureHumidity(start, end, "livingroom-microclimate");
        const y = db.getTemperatureInOut(start, end, "livingroom-heater");

        Promise.all([x,y]).then(result => {
            res.render('index', {
                start: start,
                end: end,
                graph1: result[0],
                graph2: result[1]
            });
        });
    };
}