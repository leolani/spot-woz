$(document).ready(function() {
    let restPath = window.location.pathname.split('/').slice(0, -3).join('/') + "/rest/";

    var scenarioId;
    $.get(restPath + "scenario")
        .then(scenario => {
            scenarioId = scenario;
            return $.post(restPath + scenarioId + "/image/final.jpg", {})
        }).then(data => {
            console.log("Put image", restPath + scenarioId + "/image/" + imageId);
            $('#submit').hide();
            checkStatus();
        });

    console.log("Rest path for ", imageId, ":", restPath);
});