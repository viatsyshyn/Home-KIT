+function () {

let Highcharts = window.Highcharts || null;
let TH_DATA: Array = window.TH_DATA || [];
let moment = window.moment || null;

Highcharts.chart('th', {
    chart: {
        zoomType: 'xy'
    },
    title: {
        text: 'Temperature and Humidity'
    },
    xAxis: [{
        categories: TH_DATA.map(x => moment(new Date(x.timestamp).toISOString()).format('MMM D HH:mm:ss')),
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
                color: Highcharts.getOptions().colors[0]
            }
        },
        labels: {
            format: '{value} %',
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
        name: 'Humidity',
        type: 'spline',
        yAxis: 1,
        data: TH_DATA.map(x => x.humidity),
        tooltip: {
            valueSuffix: ' %'
        }

    }, {
        name: 'Temperature',
        type: 'spline',
        data: TH_DATA.map(x => x.temperature),
        tooltip: {
            valueSuffix: 'C'
        }
    }]
});

}();