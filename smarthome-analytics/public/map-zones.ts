//noinspection JSUnresolvedVariable
let $ = window.jQuery;

$(function(event) {
    console.log("DOM fully loaded and parsed");

    let current_drag, deltaX, deltaY;

    $('#zones, #bp').on('mousedown', '.zone', (event: MouseEvent) => {
        current_drag = $(event.target).closest('.zone');

        event.preventDefault();
        event.stopPropagation();

        let offset = current_drag.offset();
        deltaX = offset.left - event.clientX;
        deltaY = offset.top - event.clientY;

        current_drag.css({
            position: 'absolute',
            top: offset.top + 'px',
            left: offset.left + 'px',
        });
    });

    $('#devices, #bp')
        .on('mousedown', '.device [data-zone]', (event: MouseEvent) => {
            event.stopPropagation();
        })
        .on('click', '.device [data-zone]', (event: MouseEvent) => {
            event.stopPropagation();

            let target = $(event.target).closest('[data-zone]');
            let el = $(event.target).closest('.device');

            target.remove();

            console.log('HERE!!!!');

            let all_zones = [].slice.call(el.children('[data-zone]').map((i, x) => $(x).data('zone')));

            $.post('/settings', {
                device: el.attr('id'),
                key: 'zones',
                value: JSON.stringify(all_zones)
            })
        });

    $('body')
        .on('mousemove', (event: MouseEvent) => {
            if (current_drag) {
                current_drag.css({
                    top: event.clientY + deltaY + 'px',
                    left: event.clientX + deltaX + 'px',
                });
            }
        })
        .on('mouseup', (event: MouseEvent) => {
            if (!current_drag) {
                return
            }

            current_drag.css({
                position: '',
                top: '',
                left: ''
            });

            $('.device').each((i, element) => {
                let el = $(element);
                let device_offset = el.offset();

                if (
                    (device_offset.left <= event.clientX && event.clientX <= device_offset.left + el.width())
                    &&
                    (device_offset.top <= event.clientY && event.clientY <= device_offset.top + el.height())
                ) {
                    let zone = current_drag.attr('id');
                    let all_zones = [].slice.call(el.children('[data-zone]').map((i, x) => $(x).data('zone')));

                    if (all_zones.indexOf(zone) === -1) {
                        let new_zone = $('<div></div>')
                            .attr('data-zone', zone)
                            .attr('style', current_drag.attr('style'))
                            .css('margin', '')
                            .css('display', '')
                            .text(current_drag.text());

                        el.append(new_zone);

                        all_zones.push(zone);

                        $.post('/settings', {
                            device: el.attr('id'),
                            key: 'zones',
                            value: JSON.stringify(all_zones)
                        });
                    }
                }
            });

            current_drag = null;
        });
});