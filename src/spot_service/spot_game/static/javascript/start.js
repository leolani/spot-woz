$(document).ready(function () {
    $('#showfaces').click(function () {
        $('.introduction').show();
        $('#continue').hide();
        $('#show').hide();
        checkStatus();
    })

    let restPath = window.location.pathname.split('/').slice(0, -3).join('/');
    var scenarioId;
    $.get(restPath + "/rest/" + "scenario").then(scenario => {
        scenarioId = scenario;
        console.log("Started scenario", scenarioId);
    });

    function checkStatus() {
        $.get(restPath + "/rest/" + scenarioId + "/part/introduction/continue").done(
            function (data) {
                if (data === "true") {
                    $('#continue').show()
                } else {
                    setTimeout(checkStatus, 1000);
                }

            }
        ).fail(
            function (data) {
                console.log("hello", data);
                $('#continue').show();
            }
        );
    }
})