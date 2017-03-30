+function () {

    let Highcharts = window.Highcharts || null;
    let AC_DATA: Array = window.AC_DATA || [];
    let moment = window.moment || null;

    Highcharts.chart('ac', {
        chart: {
            zoomType: 'xy'
        },
        title: {
            text: 'Air Conditioning'
        },
        xAxis: [{
            categories: AC_DATA.map(r => moment(r.timestamp).format('MMM D HH:mm:ss')),
            crosshair: true
        }],
        yAxis: [{ // Primary yAxis
            labels: {
                format: '{value} C',
                style: {
                    color: Highcharts.getOptions().colors[1]
                }
            },
            title: {
                text: 'Temperature',
                style: {
                    color: Highcharts.getOptions().colors[1]
                }
            }
        }, { // Secondary yAxis
            title: {
                text: 'Power',
                style: {
                    color: Highcharts.getOptions().colors[2]
                }
            },
            labels: {
                format: '{value}',
                style: {
                    color: Highcharts.getOptions().colors[2]
                }
            },
            opposite: true
        }, { // Tertiary yAxis
            title: {
                text: 'Mode',
                style: {
                    color: Highcharts.getOptions().colors[0]
                }
            },
            labels: {
                format: '{value}',
                style: {
                    color: Highcharts.getOptions().colors[0]
                }
            },
            opposite: true
        }],
        tooltip: {
            shared: true
        },
        legend: {
            enabled: false
        },
        series: [{
            name: 'htemp',
            type: 'spline',
            yAxis: 0,
            data: AC_DATA.map(r => r.htemp),
            tooltip: {
                valueSuffix: ' C'
            }

        }, {
            name: 'otemp',
            type: 'spline',
            yAxis: 0,
            data: AC_DATA.map(r => r.otemp),
            tooltip: {
                valueSuffix: ' C'
            }

        }, {
            name: 'Power',
            type: 'spline',
            step: 'left',
            yAxis: 1,
            data: AC_DATA.map(r => r.pow),

        }, {
            name: 'Mode',
            type: 'spline',
            step: 'left',
            yAxis: 2,
            data: AC_DATA.map(r => r.mode)
        }]
    });

}();