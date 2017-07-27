//noinspection JSUnresolvedVariable
let $ = window.jQuery;

$(function(event) {
    console.log("DOM fully loaded and parsed");

    let current_drag, deltaX, deltaY;

    $('#devices, #bp').on('mousedown', '.device', (event: MouseEvent) => {
        current_drag = $(event.target).closest('.device');

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

            let device = current_drag.attr('id');
            let map = $('#bp');
            let map_offset = map.offset();
            let x = null;
            let y = null;

            if (!(
                (map_offset.left <= event.clientX && event.clientX <= map_offset.left + map.width())
                &&
                (map_offset.top <= event.clientY && event.clientY <= map_offset.top + map.height())
            )) {
                current_drag.css({
                    position: ''
                });

                $('#devices').append(current_drag);
            } else {

                x = event.clientX + deltaX - map_offset.left;
                y = event.clientY + deltaY - map_offset.top;

                map.append(current_drag);
            }

            current_drag.css({
                top: y + 'px',
                left: x + 'px'
            });

            current_drag = null;

            $.post('/settings', {
                device: device,
                key: 'position',
                value: JSON.stringify({
                    x : x,
                    y : y
                })
            })
        });
});