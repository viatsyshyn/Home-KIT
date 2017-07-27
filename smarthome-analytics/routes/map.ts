let elements: any = {
    "MAC": "C1:5D:3A:AE:5E:FA",
    "PIC": "031-45-154",
    "port": 51827,
    "name": "MyHomeKit",

    "pubsub": "mqtt://127.0.0.1:1883",
    "storage": "mongodb://localhost:27017/homekit",
    "cache": "redis://localhost:6379",

    "accessories": [{
        "package": "./sample-accessory.js",
        "id": "livingroom-heater",
        "zones": ["livingroom"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "livingroom-microclimate",
        "zones": ["livingroom"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "livingroom-ac",
        "zones": ["livingroom"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "bedroom-heater",
        "zones": ["bedroom"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "portable-heater",
        "zones": ["bedroom"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "bedroom-microclimate",
        "zones": ["bedroom"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "cabinet-heater",
        "zones": ["cabinet"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "cabinet-microclimate",
        "zones": ["cabinet"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "bathroom-microclimate",
        "zones": ["bathroom"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "bathroom-fan",
        "zones": ["bathroom"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "toilet-microclimate",
        "zones": ["toilet"],
        "params": {}
    }, {
        "package": "./sample-accessory.js",
        "id": "toilet-fan",
        "zones": ["toilet"],
        "params": {}
    }]
};

export function map(db) {
    return function (req, res) {
        let map_img = db.getSettings("img");
        let device_posi = db.getSettings("position");
        Promise.all([map_img, device_posi])
            .then(([img, devices]) => {
                res.render('map', {
                    is_img: img,
                    elements: elements.accessories.map(x => ({
                        id: x.id,
                        img: `/accessories/${x.id.split('-').pop()}.png`,
                        title: x.id.split('-').pop().toUpperCase(),
                        position: (devices.find((pos) => pos.device === x.id) || {}).value || {x: null, y: null}
                    }))
                });
            });
    };
}

export function bpupload(db) {
    return function (req, res, next) {
        db.setSettings({device: "~", key: "img", value: req.file.filename});

        res.redirect('/map');
    };
}
export function set_settings(db) {
    return function (req, res, next) {
        db.setSettings({device: req.body.device, key: req.body.key, value: JSON.parse(req.body.value)});
        res.json(true);
    };
}