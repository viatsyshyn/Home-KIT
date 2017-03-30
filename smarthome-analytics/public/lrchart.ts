+function () {

    let Highcharts = window.Highcharts || null;
    let LR_DATA: Array = window.LR_DATA || [];
    let moment = window.moment || null;

    Highcharts.chart('lrc', {
        chart: {
            zoomType: 'xy'
        },
        title: {
            text: 'Livingroom State'
        },
        xAxis: [{
            categories: LR_DATA.map(v => moment(v.timestamp).format('MMM D HH:mm:ss')),
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
                text: 'Humidity',
                style: {
                    color: Highcharts.getOptions().colors[2]
                }
            },
            labels: {
                format: '{value} %',
                style: {
                    color: Highcharts.getOptions().colors[2]
                }
            },
            opposite: false
        }, { // Tertiary yAxis
            title: {
                text: 'State',
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
            name: 'current Temperature',
            type: 'spline',
            yAxis: 0,
            data: LR_DATA.map(v => v.currentTemperature),
            tooltip: {
                valueSuffix: ' C'
            }

        }, {
            name: 'target Temperature',
            type: 'spline',
            step: 'left',
            yAxis: 0,
            data: LR_DATA.map(v => v.targetTemperature),
            tooltip: {
                valueSuffix: ' C'
            }

        }, {
            name: 'current Humidity',
            type: 'spline',
            yAxis: 1,
            data: LR_DATA.map(v => v.currentHumidity),
            tooltip: {
                valueSuffix: ' %'
            }

        }, {
            name: 'target Humidity',
            type: 'spline',
            step: 'left',
            yAxis: 1,
            data: LR_DATA.map(v => v.targetHumidity),
            tooltip: {
                valueSuffix: ' %'
            }

        }, {
            name: 'Heater Cooler State',
            type: 'spline',
            step: 'left',
            yAxis: 2,
            data: LR_DATA.map(v => v.heaterCoolerState)
        }, {
            name: 'Humidifier-Dehumidifier State',
            type: 'spline',
            step: 'left',
            yAxis: 2,
            data: LR_DATA.map(v => v.humidifierDehumidifierState)
        }]
    });

}();