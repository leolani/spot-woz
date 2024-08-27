$(document).ready(function() {
    $(window).on("message onmessage", function(event) {
        console.log("Received event", event);
        if (event.originalEvent.data === "requestHref") {
            event.originalEvent.source.postMessage($(location).attr("href"), event.originalEvent.origin);
        }
    });

    let restPath = window.location.pathname.split('/').slice(0, -3).join('/') + "/rest/";
    let imageId = $(".image_container > img").attr('src').split('/').slice(-1)[0].slice(0, -4);

    var scenarioId;
    $.get(restPath + "scenario")
        .then(scenario => {
            scenarioId = scenario;
            return $.post(restPath + scenarioId + "/image/" + imageId, {})
        }).then(data => {
            console.log("Put image", restPath + scenarioId + "/image/" + imageId);
            $('#submit').css("visibility", "hidden");
            checkStatus();
        });

    console.log("Rest path for ", imageId, ":", restPath);

    $('select').change(function() {
        $(this).hide();
        let checkmark = $(this).attr('name');
        $('#' + checkmark).show();
        $('label[for="' + $(this).attr('id') + '"]').hide();
        console.log("XXX practice select", restPath, checkmark, $(this).val());
        checkStatus();
    });

    function checkStatus() {
        $.get(restPath + scenarioId + "/part/practice/continue").done(
        function ( data ) {
            if(data === "true") {
                $('#submit').css("visibility", "visible");
            }
            else{
                setTimeout(checkStatus, 1000);
            }
        }
    ).fail(
        function ( data ) {
            console.log("hello", data );
            $('#submit').css("visibility", "visible");
        }
    )}
});