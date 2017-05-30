export function map(db) {
    return function (req, res) {

        res.render('map', {});
    };
}

export function bpupload(db) {
    return function (req, res, next) {
        console.log(req.body);
        console.log(req.file);
        res.status(204).end();
    };
}