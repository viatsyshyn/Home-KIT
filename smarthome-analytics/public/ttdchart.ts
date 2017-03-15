+function () {

let Highcharts = window.Highcharts || null;
let TT_DATA: Array = window.TT_DATA || [];
let moment = window.moment || null;

Highcharts.chart('ttd', {
    chart: {
        zoomType: 'xy'
    },
    title: {
        text: 'Livingroom Heater'
    },
    xAxis: [{
        categories: TT_DATA.map(x => moment(x.timestamp).format('MMM D HH:mm:ss')),
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
            text: 'Active',
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
    }],
    tooltip: {
        shared: true
    },
    legend: {
        enabled: false
    },
    series: [{
        name: 'Temperature In',
        type: 'spline',
        data: TT_DATA.map(y => y.temperatureIn),
        tooltip: {
            valueSuffix: 'C'
        }

    }, {
        name: 'Temperature Out',
        type: 'spline',
        data: TT_DATA.map(y => y.temperatureOut),
        tooltip: {
            valueSuffix: 'C'
        }
    }]
});

}();