$(document).ready(function () {
    let turn_button = $('<button id="turn_button"><img/></button>');

    function checkTurn() {
        $.get('/vad/rest/active').done(data => {
                if (data.toString().trim().toLowerCase() === "true") {
                    console.log("Enabled turn button")
                    turn_button.prop("disabled", false);
                } else {
                    setTimeout(checkTurn, 500);
                }
            }
        );
    }

    turn_button.on('click', () => {
        $.post('/vad/rest/stop').done(data => {
            turn_button.prop("disabled", true);
            checkTurn();
            console.log("Finished turn")
        });
    });

    $.get('/vad/rest/active')
        .done(() => turn_button.appendTo($("body")))
        .fail(() => console.log("Turn taking not active"));

    turn_button.prop("disabled", true);
    setTimeout(checkTurn, 500);
})