$(document).ready(function() {
    let score = 0;
    let shown = 0;

    let restPath = window.location.pathname.split('/').slice(0, -3).join('/') + "/rest/";
    let imageId = $(".image_container > img").attr('src').split('/').slice(-1)[0].slice(0, -4);

    var scenarioId;
    $.get(restPath + "scenario")
        .then(scenario => {
            scenarioId = scenario;
            return $.post(restPath + scenarioId + "/image/" + imageId, {})
        }).then(data => {
            console.log("Put image", restPath + scenarioId + "/image/" + imageId);
            $('#submit').hide();
            checkStatus();
        });

    console.log("Rest path for ", imageId, ":", restPath);

    const searchParams = new URLSearchParams(window.location.search);
    let total = 0;
    if(searchParams.has('total_score')){
        total = searchParams.get('total_score');
        total = parseInt(total);
    }
    $('#total').val(total);

    function checkStatus() {
        $.get(restPath + scenarioId + "/part/round/continue")
            .done(data => {
                if(data === "true"){
                    $('#submit').show()}
                else{
                    setTimeout(checkStatus, 1000);
                }
            }).fail(data => {
                console.log("Failure", data );
                $('#submit').show();
            });
    }

    function fadeOut(){
        $('.hide').css('visibility','hidden')
        $('.show').show()
    }
    setTimeout(fadeOut, 10000);
    $('select').change(function() {
        $(this).hide();
        let checkmark = $(this).attr('name');
        $('#' + checkmark).show();
        $('label[for="' + $(this).attr('id') + '"]').hide();
        let answer = $(this).val();
        let trueAnswer = $(this).attr('class');
        if(answer === trueAnswer) {
            score += 1;
            total += 1;
            $('#score').val(score);
            $('#total').val(total)
        }
        $.post(restPath + scenarioId + "/image/" + imageId + "/choice?check=" + checkmark + "?choice=" + answer);
        console.log("Game choice", restPath, checkmark, answer);
    });

    $('#show').click(function(){
        $('.hide').css('visibility','visible');
        $(this).hide();
        shown += 1;
        $('#shown').val(shown);
        setTimeout(fadeOut, 10000);
    });
});