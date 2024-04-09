$(document).ready(function() {
    let score = 0;
    let shown = 0;
    const searchParams = new URLSearchParams(window.location.search);
    let total = 0;
    let restPath = window.location.pathname.split('/').slice(0, -2).join('/');

    if(searchParams.has('total_score')){
        total = searchParams.get('total_score');
        total = parseInt(total);
    }

    let imageId = $(".image_container > img").attr('src').split('/').slice(-1)[0].slice(0, -4);

    var scenarioId;
    $.get(restPath + "/rest/" + "scenario").then(scenario => {
        scenarioId = scenario;
        $.post(restPath + "/rest/" + scenarioId + "/image/" + imageId, {});
        console.log("Put image", restPath + scenarioId + "/image/" + imageId);
    });

    console.log("Rest path for ", imageId, ":", restPath);

    function checkStatus() {
        $.get(restPath + "/rest/" + scenarioId + "/part/round/continue").done(
        function ( data ) {
            if(data === "true"){
                $('#submit').show()}
            else{
                setTimeout(checkStatus, 1000);
            }
        }
    ).fail(
        function ( data ) {
            console.log("Failure", data );
            $('#submit').show();
        }
    )}

    $('#total').val(total);

    function fadeOut(){
        $('.hide').css('visibility','hidden')
        $('.show').show()
    }

    setTimeout(fadeOut, 10000);

    $('select').change(function() {
        $(this).hide();
        let checkmark = $(this).attr('name');
        $('#'+checkmark).show();
        let answer = $(this).val();
        let trueAnswer = $(this).attr('class');
        if(answer === trueAnswer) {
            score += 1;
            total += 1;
            $('#score').val(score);
            $('#total').val(total)
        }
        console.log("XXX game select", restPath, checkmark, answer);
    });

    $('#show').click(function(){
        $('.hide').css('visibility','visible');
        $(this).hide();
        shown += 1;
        $('#shown').val(shown);
        setTimeout(fadeOut, 10000);
    });

    $('#submit').hide();
    checkStatus();
});