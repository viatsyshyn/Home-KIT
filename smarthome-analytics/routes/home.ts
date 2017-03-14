export function home(db) {
    return function (req, res) {

        let x = db.getTemperatureHumidity(new Date('2017-03-13'), new Date('2017-03-14'), "livingroom-microclimate");
        x.then((x) => {
            res.render('index', {
                graph1: x
            });
        })
    };
}