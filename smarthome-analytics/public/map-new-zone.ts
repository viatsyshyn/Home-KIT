let $ = window.jQuery;

$(function(event) {
    console.log("DOM fully loaded and parsed");

    $("#zoneform").on('submit', function (e) {
        e.stopPropagation();
        e.preventDefault();

        let newzone = $("input[name=value]").val();

        let add_zone = $('<div></div>')
            .attr('class', 'zone')
            .attr('id', newzone)
            .css('display', 'inline-block')
            .css('margin', '5px')
            .text(newzone);

        $('#zones').append(add_zone);

        let zones_list = [].slice.call($('#zones').children('.zone').map((i, x) => $(x).attr('id')));
        let color_index = zones_list.indexOf(newzone);

        add_zone.css('background-color', `${COLORS[color_index]}`);

        $.post('/settings', {
            device: '~',
            key: 'zones',
            value: JSON.stringify(zones_list)
        });
        return false;
    });

    $('#zones')
        .on('mousedown', '.zone', (event: MouseEvent) => {
            event.stopPropagation();
        })
        .on('dblclick', '.zone', (event: MouseEvent) => {
            event.stopPropagation();
            let target = $(event.target).closest('.zone');

            if (
                $(`.device [data-zone=${target.attr('id')}]`).length > 0
            ) {
                alert('Some kind of device use ' + target.attr('id') + ' zone');
            } else {
                target.remove();

                let zones_list = [].slice.call($('#zones').children('.zone').map((i, x) => $(x).attr('id')));
                $.post('/settings', {
                    device: '~',
                    key: 'zones',
                    value: JSON.stringify(zones_list)
                });
            }

        return false;
        });

});