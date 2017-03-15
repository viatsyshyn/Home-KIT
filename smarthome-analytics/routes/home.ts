export function home(db) {
    return function (req, res) {

        let x = db.getTemperatureHumidity(new Date('2017-03-11'), new Date('2017-03-15'), "livingroom-microclimate");
        let y = db.getTemperatureInOut(new Date('2017-03-11'), new Date('2017-03-15'), "livingroom-heater");
        Promise.all([x,y]).then(result => {
            res.render('index', {
                graph1: result[0],
                graph2: result[1]
            });
        });
    };
}