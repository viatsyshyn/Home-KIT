let Highcharts = window.Highcharts || null;
let TT_DATA : Array = window.TT_DATA || [];

Highcharts.chart('ttd', {
    chart: {
        zoomType: 'xy'
    },
    title: {
        text: 'Temperature and Temperature'
    },
    xAxis: [{
        categories: TT_DATA.map(y => new Date(y.timestamp).toISOString()),
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
            text: 'TemperatureIn',
            style: {
                color: Highcharts.getOptions().colors[1]
            }
        }
    }, { // Secondary yAxis
        title: {
            text: 'TemperatureOut',
            style: {
                color: Highcharts.getOptions().colors[0]
            }
        },
        labels: {
            format: '{value} C',
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
        name: 'TemperatureIn',
        type: 'spline',
        yAxis: 1,
        data: TT_DATA.map(y => y.temperatureIn),
        tooltip: {
            valueSuffix: 'C'
        }

    }, {
        name: 'TemperatureOut',
        type: 'spline',
        data: TT_DATA.map(y => y.temperatureOut),
        tooltip: {
            valueSuffix: 'C'
        }
    }]
});