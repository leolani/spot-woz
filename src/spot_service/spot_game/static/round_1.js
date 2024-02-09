$(document).ready(function() {
    let score = 0;
    let shown = 0;

    let restPath = window.location.pathname.split('/').slice(0, -2).join('/') + "/rest/";
    let imageId = $(".image_container > img").attr('src').split('/').slice(-1)[0].slice(0, -4);

    var scenarioId;
    $.get(restPath + "scenario").then(scenario => {
        scenarioId = scenario;
        $.post(restPath + scenarioId + "/image/" + imageId, {});
        console.log("Put image", restPath + scenarioId + "/image/" + imageId);
    });

    function fadeOut(){
        $('.hide').css('visibility','hidden')
        $('.show').show()
    }
    setTimeout(fadeOut, 10000);
    $('select').change(function() {
        $(this).hide();
        // let character = $(this).attr('name');
        // $('#'+character).show();
        let checkmark = $(this).attr('name');
        $('#' + checkmark).show();
        let answer = $(this).val();
        let trueAnswer = $(this).attr('class');
        if(answer === trueAnswer) {
            score += 1;
            $('#score').val(score);
        }
        $.post(restPath + scenarioId + "/image/" + imageId + "/choice?check=" + checkmark + "?choice=" + answer);
        console.log("Stored choice", restPath + scenarioId + "/image/" + imageId + "/choice?check=" + checkmark + "?choice=" + answer);
    });
    $('#show').click(function(){
        $('.hide').css('visibility','visible');
        $(this).hide();
        shown += 1;
        $('#shown').val(shown);
        setTimeout(fadeOut, 10000);
    });
});