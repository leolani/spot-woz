    // let score = 0;
    // let shown = 0;

$(document).ready(function() {
    $(window).on("message onmessage", function(event) {
        if (event.originalEvent.data === "requestHref") {
            event.originalEvent.source.postMessage($(location).attr("href"), event.originalEvent.origin);
        }
    });

    let restPath = window.location.pathname.split('/').slice(0, -3).join('/');
    let imageId = $(".image_container > img").attr('src').split('/').slice(-1)[0].slice(0, -4);

    var scenarioId;
    $.get(restPath + "/rest/" + "scenario").then(scenario => {
        scenarioId = scenario;
        $.post(restPath + "/rest/" + scenarioId + "/image/" + imageId, {});
        console.log("Put image", restPath + scenarioId + "/image/" + imageId);
    });

    console.log(restPath);

    $('select').change(function() {
        $(this).hide();
        let checkmark = $(this).attr('name');
        $('#' + checkmark).show();
        $('label[for="' + $(this).attr('id') + '"]').hide();
        console.log("XXX practice select", restPath, checkmark, $(this).val());
        checkStatus();
    });

    function checkStatus() {
        $.get(restPath + "/rest/" + scenarioId + "/part/practice/continue").done(
        function ( data ) {
            if(data === "true"){
                $('#submit').show()}
            else{
                setTimeout(checkStatus, 1000);
            }
        }
    ).fail(
        function ( data ) {
            console.log("hello", data );
            $('#submit').show();
        }
    )}
});